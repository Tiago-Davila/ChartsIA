import { NoSqlFieldsSchema } from '../model/nosql-elements.js';
import { sanitizeImageDataUrl } from '../model/image-data.js';
import { type FigureShape } from '../model/enums.js';
import { ARROWS } from '../shapes/general/figure.js';
import { FONT } from '../shapes/types.js';
import { type RawCell } from './drawio-read.js';
import { htmlToMarkdown, plainText } from './drawio-text.js';
import { importStyle } from './drawio-style.js';
import { type Style } from '../model/style.js';

type Fields = Record<string, unknown>;

/** Elemento ya traducido, sin id, posición ni padre: eso lo completa el importador. */
export interface BuiltElement {
  fields: Fields;
  style?: Style;
  /** Posición absoluta distinta de la de la celda (p. ej. la especialización). */
  at?: { x: number; y: number };
  /** El tamaño de la celda se respeta como mínimo (`resized`). */
  sized?: boolean;
}

export interface BuildContext {
  cells: Map<string, RawCell>;
  children: Map<string, RawCell[]>;
  warn(message: string): void;
  /** Recorta un texto al máximo del modelo y avisa una vez. */
  clip(text: string, max: number): string;
  /** Posición absoluta de la celda: draw.io guarda a los hijos relativos a su contenedor. */
  abs(cell: RawCell): { x: number; y: number };
}

const isCompartment = (c: RawCell) => c.style.has('swimlane') && c.style.get('childLayout') === 'stackLayout';
const isCollection = (c: RawCell) => c.object?.get('kind') === 'collection';
const html = (c: RawCell) => c.style.get('html') === '1';
const label = (c: RawCell) => plainText(c.value, html(c)).trim();

/** Celdas que forman parte de otro elemento (miembros, partes de figuras ER, etiquetas de aristas) y no son elementos propios. */
export function claimedCells(cells: RawCell[], children: Map<string, RawCell[]>): Set<string> {
  const claimed = new Set<string>();
  const byId = new Map(cells.map((c) => [c.id, c]));
  for (const cell of cells) {
    if (cell.edge) {
      for (const child of children.get(cell.id) ?? []) claimed.add(child.id);
    } else if (isCompartment(cell)) {
      for (const child of children.get(cell.id) ?? []) if (child.style.has('text') || child.style.has('line')) claimed.add(child.id);
    } else if (isCollection(cell)) {
      for (const child of children.get(cell.id) ?? []) claimed.add(child.id);
    }
    const kind = cell.style.get('chartsia');
    const parts = kind === 'specialization' ? ['kind', 'name'] : kind === 'attribute' ? ['partial-key'] : kind === 'relationship' ? ['inner'] : [];
    for (const part of parts) if (byId.has(`${cell.id}-${part}`)) claimed.add(`${cell.id}-${part}`);
  }
  return claimed;
}

const VISIBILITY = /^([+\-#~])\s*/;

/** Separa por comas que no estén dentro de <>, () ni []. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if ('<([{'.includes(char)) depth++;
    else if ('>)]}'.includes(char)) depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Mismo formato que `formatAttribute`: "+ nombre: tipo = valor". */
function parseAttribute(text: string, isStatic: boolean) {
  let rest = text.trim();
  const vis = VISIBILITY.exec(rest);
  if (vis) rest = rest.slice(vis[0].length);
  let defaultValue: string | undefined;
  const eq = rest.indexOf('=');
  if (eq >= 0) {
    defaultValue = rest.slice(eq + 1).trim();
    rest = rest.slice(0, eq).trim();
  }
  const colon = rest.indexOf(':');
  const name = (colon >= 0 ? rest.slice(0, colon) : rest).trim();
  const type = colon >= 0 ? rest.slice(colon + 1).trim() : '';
  if (!name) return undefined;
  return { name, ...(type ? { type } : {}), visibility: vis?.[1] ?? '+', ...(isStatic ? { static: true } : {}), ...(defaultValue !== undefined ? { defaultValue } : {}) };
}

const OPERATION = /^([+\-#~])?\s*(default\s+)?([^()]+?)\s*\((.*)\)\s*(?::\s*(.+))?$/s;
const looksLikeOperation = (text: string) => OPERATION.test(text.trim());

/** Mismo formato que `formatMethod`: "+ nombre(a: T, b): R". */
function parseOperation(text: string, flags: { isStatic: boolean; isAbstract: boolean }) {
  const match = OPERATION.exec(text.trim());
  if (!match) return undefined;
  const parameters = splitTopLevel(match[4]!).map((param) => {
    const colon = param.indexOf(':');
    const name = (colon >= 0 ? param.slice(0, colon) : param).trim();
    const type = colon >= 0 ? param.slice(colon + 1).trim() : '';
    return { name, ...(type ? { type } : {}) };
  });
  const returnType = match[5]?.trim();
  return {
    name: match[3]!.trim(),
    parameters,
    ...(returnType ? { returnType } : {}),
    visibility: match[1] ?? '+',
    ...(flags.isStatic ? { static: true } : {}),
    ...(flags.isAbstract ? { abstract: true } : {}),
    ...(match[2] ? { default: true } : {}),
  };
}

/** Mismo formato que `formatColumn`: "PK FK nombre: tipo NOT NULL UNIQUE"; devuelve también si era FK. */
function parseColumn(text: string) {
  let rest = text.trim();
  let pk = false;
  let fk = false;
  for (;;) {
    if (/^PK\s/.test(rest)) { pk = true; rest = rest.slice(2).trim(); }
    else if (/^FK\s/.test(rest)) { fk = true; rest = rest.slice(2).trim(); }
    else break;
  }
  const unique = /\sUNIQUE$/.test(rest);
  if (unique) rest = rest.slice(0, -'UNIQUE'.length).trim();
  const notNull = /\sNOT NULL$/.test(rest);
  if (notNull) rest = rest.slice(0, -'NOT NULL'.length).trim();
  const colon = rest.indexOf(':');
  const name = colon >= 0 ? rest.slice(0, colon).trim() : '';
  const type = colon >= 0 ? rest.slice(colon + 1).trim() : '';
  if (!name || !type) return undefined;
  return { fk, column: { name, type, ...(pk ? { pk: true } : {}), ...(notNull ? { notNull: true } : {}), ...(unique ? { unique: true } : {}) } };
}

/** Clase, interfaz, enumeración, tabla o lista de valores: un `swimlane` con una celda por miembro. */
function buildCompartment(cell: RawCell, ctx: BuildContext): BuiltElement | undefined {
  const parts = (ctx.children.get(cell.id) ?? []).filter((c) => c.vertex);
  const separators = parts.filter((c) => c.style.has('line')).map((c) => c.geometry?.y ?? 0);
  const rows = parts
    .filter((c) => c.style.has('text'))
    .sort((a, b) => (a.geometry?.y ?? 0) - (b.geometry?.y ?? 0))
    .map((row) => {
      const fontStyle = parseInt(row.style.get('fontStyle') ?? '0', 10) || 0;
      return {
        text: label(row),
        slot: row.id.startsWith(cell.id + ':') ? row.id.slice(cell.id.length + 1) : '',
        italic: (fontStyle & 2) !== 0,
        underline: (fontStyle & 4) !== 0,
        section: separators.filter((y) => y < (row.geometry?.y ?? 0)).length,
      };
    })
    .filter((row) => row.text);
  const lines = label(cell).split('\n').map((l) => l.trim()).filter(Boolean);
  const stereotypes: string[] = [];
  while (lines.length > 1 && /^«.*»$/.test(lines[0]!)) stereotypes.push(lines.shift()!.slice(1, -1).trim());
  const name = ctx.clip(lines.join(' ') || cell.id, 200);
  const style = importStyle(cell.style);

  if (rows.some((r) => r.slot.startsWith('column:'))) {
    const columns = [];
    let droppedKeys = false;
    for (const row of rows) {
      const parsed = parseColumn(row.text);
      if (!parsed) {
        ctx.warn(`La columna "${row.text}" de "${name}" no tiene el formato "nombre: tipo" y se omitió.`);
        continue;
      }
      droppedKeys ||= parsed.fk;
      columns.push(parsed.column);
    }
    if (droppedKeys) ctx.warn(`Las claves foráneas de "${name}" se importaron como columnas normales: draw.io no guarda la tabla y columna destino.`);
    return { fields: { kind: 'table', name, columns }, style };
  }
  if (rows.some((r) => r.slot.startsWith('value:'))) {
    return { fields: { kind: 'value-list', name, values: [...new Set(rows.map((r) => r.text))] }, style };
  }

  const lower = stereotypes.map((s) => s.toLowerCase());
  const isInterface = lower.includes('interface');
  const isEnum = lower.includes('enumeration') || lower.includes('enum');
  const attributes = [];
  const operations = [];
  const literals: string[] = [];
  for (const row of rows) {
    if (isEnum && (row.slot.startsWith('literal:') || (!row.slot && row.section === 0))) {
      if (!literals.includes(row.text)) literals.push(row.text);
      continue;
    }
    const operation = row.slot.startsWith('operation:') || (!row.slot.startsWith('attribute:') && looksLikeOperation(row.text));
    const member = operation
      ? parseOperation(row.text, { isStatic: row.underline, isAbstract: row.italic && !isInterface })
      : parseAttribute(row.text, row.underline);
    if (!member) ctx.warn(`El miembro "${row.text}" de "${name}" no se pudo leer y se omitió.`);
    else if (operation) operations.push(member);
    else attributes.push(member);
  }
  if (isInterface) return { fields: { kind: 'interface', name, ...(attributes.length ? { attributes } : {}), operations }, style };
  if (isEnum && literals.length) {
    return { fields: { kind: 'enum', name, literals, ...(attributes.length ? { attributes } : {}), ...(operations.length ? { operations } : {}) }, style };
  }
  const extra = lower.find((s) => s !== 'abstract');
  return {
    fields: { kind: 'class', name, ...(lower.includes('abstract') ? { abstract: true } : {}), ...(extra ? { stereotype: ctx.clip(extra, 60) } : {}), attributes, operations },
    style,
  };
}

/** Elementos C4: `object` con `c4Name`, `c4Type`, `c4Description` y `c4Technology`, como la librería C4 de draw.io. */
function buildC4(cell: RawCell, ctx: BuildContext): BuiltElement | undefined {
  const object = cell.object!;
  const type = (object.get('c4Type') ?? '').trim();
  const external = /external/i.test(type);
  const base = type.replace(/\s*-\s*external/i, '').replace(/\s+/g, '').toLowerCase();
  const name = ctx.clip(object.get('c4Name')?.trim() || label(cell).split('\n')[0] || cell.id, 200);
  const description = object.get('c4Description')?.trim();
  const technology = object.get('c4Technology')?.trim();
  const common = {
    name,
    ...(description ? { description: ctx.clip(description, 1000) } : {}),
  };
  const style = importStyle(cell.style, FONT.c4Description);
  const isBoundary = cell.style.get('container') === '1' || (cell.style.get('dashed') === '1' && cell.style.get('fillColor') === 'none');
  if (isBoundary) {
    const boundaryType = base === 'enterprise' ? 'enterprise' : base === 'container' || base === 'containerscopeboundary' ? 'container' : 'system';
    return { fields: { kind: 'boundary', name, boundaryType }, style, sized: true };
  }
  if (base === 'person') return { fields: { kind: 'person', ...common, ...(external ? { external: true } : {}) }, style, sized: true };
  if (base === 'softwaresystem') return { fields: { kind: 'software-system', ...common, ...(external ? { external: true } : {}) }, style, sized: true };
  if (base === 'component') return { fields: { kind: 'component', ...common, ...(technology ? { technology: ctx.clip(technology, 120) } : {}) }, style, sized: true };
  if (base === 'container') {
    const shape = cell.style.get('shape') ?? '';
    const variant = shape === 'cylinder3' ? (cell.style.get('direction') === 'south' ? 'queue' : 'database') : shape === 'mxgraph.c4.webBrowserContainer2' ? 'web' : undefined;
    return { fields: { kind: 'container', ...common, ...(technology ? { technology: ctx.clip(technology, 120) } : {}), ...(variant ? { variant } : {}) }, style, sized: true };
  }
  ctx.warn(`El elemento C4 "${name}" es de tipo "${type}", que no tiene equivalente, y se omitió.`);
  return undefined;
}

/** Colección NoSQL: `object` con sus campos como JSON; las celdas hijas solo son el dibujo. */
function buildCollection(cell: RawCell, ctx: BuildContext): BuiltElement | undefined {
  const name = ctx.clip(cell.object!.get('name')?.trim() || cell.id, 200);
  let raw: unknown;
  try {
    raw = JSON.parse(cell.object!.get('fields') ?? '[]');
  } catch {
    raw = undefined;
  }
  const fields = NoSqlFieldsSchema.safeParse(raw);
  if (!fields.success) {
    ctx.warn(`Los campos de la colección "${name}" no son válidos y se omitió.`);
    return undefined;
  }
  return { fields: { kind: 'collection', name, fields: fields.data } };
}

/** Figuras de la notación Chen; la marca `chartsia=` del estilo distingue entidad, atributo, relación y especialización de las figuras generales. */
function buildEr(cell: RawCell, kind: string, ctx: BuildContext): BuiltElement | undefined {
  const name = ctx.clip(label(cell) || cell.id, 200);
  if (kind === 'entity') {
    return {
      fields: { kind, name, ...(cell.style.get('double') === '1' ? { weak: true } : {}), ...(cell.style.get('dashed') === '1' ? { associative: true } : {}) },
      style: importStyle(cell.style),
      sized: true,
    };
  }
  if (kind === 'attribute') {
    const partialKey = ctx.cells.has(`${cell.id}-partial-key`);
    const key = !partialKey && ((parseInt(cell.style.get('fontStyle') ?? '0', 10) || 0) & 4) !== 0;
    return {
      fields: {
        kind, name,
        ...(key ? { key: true } : {}),
        ...(partialKey ? { partialKey: true } : {}),
        ...(cell.style.get('shape') === 'doubleEllipse' ? { multivalued: true } : {}),
        ...(cell.style.get('dashed') === '1' ? { derived: true } : {}),
      },
      style: importStyle(cell.style, FONT.member),
      sized: true,
    };
  }
  if (kind === 'relationship') {
    return { fields: { kind, name, ...(ctx.cells.has(`${cell.id}-inner`) ? { identifying: true } : {}) }, style: importStyle(cell.style, FONT.member), sized: true };
  }
  if (kind === 'specialization') {
    const nameCell = ctx.cells.get(`${cell.id}-name`);
    const kindCell = ctx.cells.get(`${cell.id}-kind`);
    const top = ctx.abs(cell);
    return {
      fields: { kind, name: ctx.clip((nameCell && label(nameCell)) || cell.id, 200), ...(kindCell && label(kindCell) === 'o' ? { overlapping: true } : {}) },
      style: importStyle(new Map([...cell.style, ...(nameCell?.style ?? [])])),
      at: { x: nameCell ? ctx.abs(nameCell).x : top.x, y: top.y },
    };
  }
  return undefined;
}

/** Figura general a partir de la forma de draw.io; `null` si la forma no tiene equivalente. */
function figureShape(style: Map<string, string>): FigureShape | null {
  const shape = style.get('shape');
  const direction = style.get('direction');
  switch (shape) {
    case 'mxgraph.basic.acute_triangle': return 'scalene-triangle';
    case 'mxgraph.basic.right_triangle': return 'right-triangle';
    case 'mxgraph.basic.pentagon': return 'pentagon';
    case 'mxgraph.basic.octagon2': return 'octagon';
    case 'hexagon': return 'hexagon';
    case 'parallelogram': return 'parallelogram';
    case 'cloud': return 'cloud';
    case 'doubleArrow': return 'double-arrow';
    case 'singleArrow': {
      if (direction === 'west') return 'arrow-left';
      if (direction === 'north') return 'arrow-up';
      if (direction === 'south') return 'arrow-down';
      return parseFloat(style.get('arrowWidth') ?? '') === ARROWS.arrow!.shaft ? 'arrow' : 'arrow-right';
    }
    case 'rhombus': return 'diamond';
    case 'triangle': return 'triangle';
    case 'ellipse': return style.get('aspect') === 'fixed' ? 'circle' : 'oval';
    case undefined: break;
    default: return null;
  }
  if (style.has('rhombus')) return 'diamond';
  if (style.has('triangle')) return 'triangle';
  if (style.has('ellipse')) return style.get('aspect') === 'fixed' ? 'circle' : 'oval';
  if (style.get('aspect') === 'fixed' && style.get('rounded') === '0') return 'square';
  return 'rectangle';
}

/** Bytes de un texto percent-encoded donde cada %XX es un byte; el resto se toma como UTF-8. */
function percentBytes(text: string): Uint8Array {
  const out: number[] = [];
  for (const part of text.split(/(%[0-9a-fA-F]{2})/)) {
    if (/^%[0-9a-fA-F]{2}$/.test(part)) out.push(parseInt(part.slice(1), 16));
    else for (const byte of new TextEncoder().encode(part)) out.push(byte);
  }
  return Uint8Array.from(out);
}

/** Imagen embebida: acepta `data:` en base64 o percent-encoded; nunca descarga URL externas. */
function buildImage(cell: RawCell, ctx: BuildContext): BuiltElement | undefined {
  const value = cell.style.get('image') ?? '';
  const match = /^data:(image\/(?:png|jpeg|svg\+xml))(?:;base64)?,(.*)$/s.exec(value);
  if (!match) {
    ctx.warn('Se omitió una imagen: solo se importan imágenes PNG, JPG o SVG embebidas, no rutas ni URL externas.');
    return undefined;
  }
  try {
    const payload = match[2]!;
    const bytes = payload.includes('%') ? percentBytes(payload) : Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const src = sanitizeImageDataUrl(`data:${match[1]};base64,${btoa(binary)}`);
    return { fields: { kind: 'image', name: ctx.clip(label(cell) || 'Imagen', 200), src }, style: importStyle(cell.style), sized: true };
  } catch (error) {
    ctx.warn('Se omitió una imagen: ' + (error instanceof Error ? error.message : 'no es una imagen válida') + '');
    return undefined;
  }
}

/** Traduce una celda vértice al elemento del modelo; lo desconocido se omite con un aviso. */
export function buildVertex(cell: RawCell, ctx: BuildContext): BuiltElement | undefined {
  const style = cell.style;
  if (isCollection(cell)) return buildCollection(cell, ctx);
  if (cell.object?.has('c4Type') || cell.object?.has('c4Name')) return buildC4(cell, ctx);
  const marked = style.get('chartsia');
  if (marked) return buildEr(cell, marked, ctx);
  if (isCompartment(cell)) return buildCompartment(cell, ctx);
  const text = label(cell);
  const name = ctx.clip(text, 200);
  if (style.get('shape') === 'folder') return { fields: { kind: 'package', name: name || 'Paquete' }, style: importStyle(style), sized: true };
  if (style.get('shape') === 'image' || style.has('image')) return buildImage(cell, ctx);
  if (style.has('group') && !text) return undefined;
  if (style.get('container') === '1' || style.has('swimlane')) return { fields: { kind: 'frame', name: name || 'Marco' }, style: importStyle(style), sized: true };
  if (style.has('text') || (style.get('strokeColor') === 'none' && style.get('fillColor') === 'none' && text)) {
    if (!text) return undefined;
    const markdown = html(cell) ? htmlToMarkdown(cell.value) : cell.value;
    return { fields: { kind: 'text', name: ctx.clip(markdown.trim() || text, 4000) }, style: importStyle(style), sized: true };
  }
  const shape = figureShape(style);
  if (shape === null) {
    ctx.warn(`La forma "${style.get('shape')}" no tiene equivalente y se omitió${text ? ` ("${name}")` : ''}.`);
    return undefined;
  }
  return { fields: { kind: 'figure', shape, name: name || ' ' }, style: importStyle(style), sized: true };
}
