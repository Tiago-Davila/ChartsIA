import { type Point, type LayoutInput, ID_PATTERN } from '../model/common.js';
import { type DiagramInput, type ElementInput } from '../model/diagram.js';
import {
  DRAWING_DEFAULT_COLOR,
  DRAWING_DEFAULT_WIDTH,
  DRAWING_MAX_COORDINATE,
  DRAWING_MAX_POINTS,
  DRAWING_MAX_STROKE_WIDTH,
  DRAWING_MIN_STROKE_WIDTH,
  HIGHLIGHTER_OPACITY,
} from '../model/drawing-elements.js';
import { type ErrorCode } from '../model/enums.js';
import { sanitizeImageDataUrl } from '../model/image-data.js';
import { type Relation } from '../model/relation.js';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, HEX_COLOR_PATTERN, type Style, type StyleFontFamily, type StyleLineWidth } from '../model/style.js';
import { TEXT_BLOCK_MAX_LENGTH } from '../model/text-elements.js';
import { DomainValidationError, validationError } from '../validation/errors.js';
import { validateDiagram } from '../validation/index.js';

export const MAX_EXCALIDRAW_SOURCE_LENGTH = 8 * 1024 * 1024;
export const MAX_EXCALIDRAW_ELEMENTS = 5_000;
export const MAX_EXCALIDRAW_WARNINGS = 50;

export interface ExcalidrawImportResult {
  diagram: DiagramInput;
  warnings: string[];
}

type Raw = Record<string, unknown>;
interface Entry { raw: Raw; index: number }

const EXCALIDRAW_DEFAULT_STROKE = '#1e1e1e';
const SHAPE_TYPES = ['rectangle', 'ellipse', 'diamond'];
const LABEL_CONTAINER_TYPES = [...SHAPE_TYPES, 'arrow'];
const ID_PREFIXES: Record<string, string> = { text: 'Texto', image: 'Imagen', frame: 'Marco', magicframe: 'Marco', line: 'Trazo', freedraw: 'Trazo', arrow: 'Flecha' };
/** Familia de fuente del modelo para cada familia numérica de Excalidraw. */
const FONT_FAMILIES: Record<number, StyleFontFamily> = { 1: 'handwritten', 2: 'sans-serif', 3: 'monospace', 4: 'sans-serif', 5: 'handwritten', 6: 'sans-serif', 7: 'sans-serif', 8: 'handwritten', 9: 'sans-serif' };

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const round = (n: number) => Math.round(n * 100) / 100;

/** Lanza un error en el formato común `code`/`path`/`message`/`hint`. */
function fail(path: string, message: string, hint: string, code: ErrorCode = 'SCHEMA_VIOLATION'): never {
  throw new DomainValidationError([validationError(code, path, message, hint)]);
}

/** Valida el texto recibido y devuelve los elementos y archivos del JSON de Excalidraw. */
function parseSource(source: unknown): { elements: Entry[]; files: Raw } {
  if (typeof source !== 'string') fail('/source', 'La entrada debe ser el texto JSON de Excalidraw.', 'Envía el contenido de un archivo .excalidraw o lo copiado desde Excalidraw como texto.');
  if (source.length > MAX_EXCALIDRAW_SOURCE_LENGTH) {
    fail('/source', `El JSON supera el máximo de ${MAX_EXCALIDRAW_SOURCE_LENGTH / 1024 / 1024} MiB.`, 'Quita imágenes pesadas o divide el boceto en varios.', 'LIMIT_EXCEEDED');
  }
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    fail('/source', 'El texto no es JSON válido.', 'Pega el contenido completo de un archivo .excalidraw o lo copiado desde Excalidraw.');
  }
  if (!isRecord(data) || (data.type !== 'excalidraw' && data.type !== 'excalidraw/clipboard')) {
    fail('/source/type', '"type" debe ser "excalidraw" o "excalidraw/clipboard".', 'Importa un archivo .excalidraw o elementos copiados desde Excalidraw; las librerías (.excalidrawlib) no se admiten.');
  }
  if (!Array.isArray(data.elements)) fail('/source/elements', '"elements" debe ser una lista de elementos.', 'Revisa que el archivo no esté cortado o corrupto.');
  if (data.elements.length > MAX_EXCALIDRAW_ELEMENTS) {
    fail('/source/elements', `El dibujo tiene ${data.elements.length} elementos y el máximo es ${MAX_EXCALIDRAW_ELEMENTS}.`, 'Importa solo una parte del dibujo.', 'LIMIT_EXCEEDED');
  }
  const elements = data.elements.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.type !== 'string') {
      fail(`/source/elements/${index}`, 'El elemento debe ser un objeto con "type".', 'Revisa que el archivo no esté corrupto.');
    }
    if (raw.isDeleted !== true) {
      for (const key of ['x', 'y']) {
        if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])) {
          fail(`/source/elements/${index}/${key}`, `"${key}" debe ser un número.`, 'Revisa que el archivo no esté corrupto.');
        }
      }
    }
    return { raw, index };
  });
  return { elements, files: isRecord(data.files) ? data.files : {} };
}

/** Número finito de un campo, o el valor por defecto si falta o no es válido. */
function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Color `#rrggbb` en minúsculas, o undefined si es transparente o no tiene esa forma. */
function hexOf(value: unknown, note: (message: string) => void): string | undefined {
  if (typeof value !== 'string' || value === 'transparent') return undefined;
  if (HEX_COLOR_PATTERN.test(value)) return value.toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) return ('#' + short[1]! + short[1]! + short[2]! + short[2]! + short[3]! + short[3]!).toLowerCase();
  note('Se omitieron colores que no son #rrggbb.');
  return undefined;
}

/** Grosor del modelo más cercano a un `strokeWidth` de Excalidraw. */
function lineWidthOf(value: unknown): StyleLineWidth | undefined {
  if (typeof value !== 'number') return undefined;
  return value <= 1.25 ? 'thin' : value <= 2.5 ? 'medium' : 'thick';
}

/** Texto original de un elemento de texto (sin los saltos de línea que añade Excalidraw al ajustar). */
function textOf(raw: Raw | undefined): string {
  if (!raw) return '';
  return typeof raw.originalText === 'string' ? raw.originalText : typeof raw.text === 'string' ? raw.text : '';
}

/** Interpreta los puntos relativos de una línea, flecha o trazo como puntos absolutos. */
function absolutePoints(raw: Raw): Point[] {
  const points = Array.isArray(raw.points) ? raw.points : [];
  return points
    .filter((p): p is number[] => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => ({ x: num(raw.x) + p[0]!, y: num(raw.y) + p[1]! }));
}

/**
 * Importa un archivo `.excalidraw` (o elementos copiados de Excalidraw) a un diagrama canónico.
 * Formas, textos, imágenes, marcos, trazos y flechas unidas a dos elementos se traducen; lo demás
 * se omite y se explica en `warnings`. Los errores son `DomainValidationError`.
 */
export function importExcalidraw(source: string, title?: string): ExcalidrawImportResult {
  const { elements: entries, files } = parseSource(source);
  const notes = new Map<string, number>();
  const note = (message: string) => notes.set(message, (notes.get(message) ?? 0) + 1);
  const hex = (value: unknown) => hexOf(value, note);

  const live = entries.filter((e) => e.raw.isDeleted !== true);
  const rawById = new Map(live.filter((e) => typeof e.raw.id === 'string').map((e) => [e.raw.id as string, e.raw]));

  // Los textos ligados a una forma o flecha son su etiqueta, no elementos propios.
  const labels = new Map<string, Raw>();
  const labelRaws = new Set<Raw>();
  for (const { raw } of live) {
    const container = typeof raw.containerId === 'string' ? rawById.get(raw.containerId) : undefined;
    if (raw.type === 'text' && container && LABEL_CONTAINER_TYPES.includes(container.type as string) && !labels.has(raw.containerId as string)) {
      labels.set(raw.containerId as string, raw);
      labelRaws.add(raw);
    }
  }

  // Se conservan los ids válidos y únicos; el resto recibe uno nuevo.
  const candidates = live.filter((e) => !labelRaws.has(e.raw));
  const used = new Set<string>();
  const ids = new Map<Raw, string>();
  for (const { raw } of candidates) {
    if (typeof raw.id === 'string' && ID_PATTERN.test(raw.id) && !used.has(raw.id)) {
      ids.set(raw, raw.id);
      used.add(raw.id);
    }
  }
  let counter = 0;
  for (const { raw } of candidates) {
    if (ids.has(raw)) continue;
    let id: string;
    do id = `${ID_PREFIXES[raw.type as string] ?? 'Figura'}${++counter}`; while (used.has(id));
    ids.set(raw, id);
    used.add(id);
  }

  const frameIds = new Map<string, string>();
  for (const { raw } of candidates) if ((raw.type === 'frame' || raw.type === 'magicframe') && typeof raw.id === 'string') frameIds.set(raw.id, ids.get(raw)!);

  /** Avisos de lo que el modelo no puede representar de un elemento. */
  const checkCommon = (raw: Raw, highlighter = false) => {
    if (num(raw.angle) !== 0) note('La rotación no se conserva: los elementos rotados se importaron sin girar.');
    if (num(raw.opacity, 100) < 100 && !highlighter) note('La opacidad no se conserva.');
    if (Array.isArray(raw.groupIds) && raw.groupIds.length > 0) note('Los grupos de Excalidraw no se conservan; sus elementos se importaron sueltos.');
    if (raw.link) note('Los enlaces de los elementos no se conservan.');
  };

  /** Estilo de línea y relleno de una forma, más el del texto que lleva dentro. */
  const styleOf = (raw: Raw, text?: Raw, withFill = true): Style | undefined => {
    const border = hex(raw.strokeColor);
    const fill = withFill ? hex(raw.backgroundColor) : undefined;
    const fontColor = hex(text?.strokeColor);
    const family = typeof text?.fontFamily === 'number' ? FONT_FAMILIES[text.fontFamily] : undefined;
    const lineWidth = lineWidthOf(raw.strokeWidth);
    const style: Style = {
      ...(border && border !== EXCALIDRAW_DEFAULT_STROKE ? { borderColor: border } : {}),
      ...(fill ? { fillColor: fill } : {}),
      ...(lineWidth ? { lineWidth } : {}),
      ...(fontColor && fontColor !== EXCALIDRAW_DEFAULT_STROKE ? { fontColor } : {}),
      ...(family ? { fontFamily: family } : {}),
      ...(typeof text?.fontSize === 'number' ? { fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(text.fontSize))) } : {}),
    };
    if (fill && raw.fillStyle !== 'solid') note('El estilo de relleno rayado o cuadriculado no tiene equivalente; se usó relleno liso.');
    if (withFill && (raw.strokeStyle === 'dashed' || raw.strokeStyle === 'dotted')) note('El borde punteado de las formas no tiene equivalente; se usó borde continuo.');
    return Object.keys(style).length > 0 ? style : undefined;
  };

  /** Campos comunes a todo elemento importado: id, bloqueo, marco que lo contiene y estilo. */
  const base = (raw: Raw, style: Style | undefined) => {
    const parent = typeof raw.frameId === 'string' ? frameIds.get(raw.frameId) : undefined;
    return {
      id: ids.get(raw)!,
      ...(parent ? { parentId: parent } : {}),
      ...(style ? { style } : {}),
      ...(raw.locked === true ? { locked: true } : {}),
    };
  };

  const sizedLayout = (raw: Raw): LayoutInput => ({
    x: round(num(raw.x)),
    y: round(num(raw.y)),
    width: Math.max(1, round(Math.abs(num(raw.width)))),
    height: Math.max(1, round(Math.abs(num(raw.height)))),
    resized: true,
  });

  /** Trazo del modelo a partir de puntos absolutos; undefined si quedan menos de dos. */
  const drawingOf = (raw: Raw, points: Point[]): ElementInput | undefined => {
    if (points.length < 2) {
      note('Se omitieron líneas con menos de dos puntos.');
      return undefined;
    }
    let kept = points;
    if (points.length > DRAWING_MAX_POINTS) {
      note(`Se simplificaron los trazos con más de ${DRAWING_MAX_POINTS} puntos.`);
      kept = Array.from({ length: DRAWING_MAX_POINTS }, (_, i) => points[Math.round((i * (points.length - 1)) / (DRAWING_MAX_POINTS - 1))]!);
    }
    const minX = Math.min(...kept.map((p) => p.x));
    const minY = Math.min(...kept.map((p) => p.y));
    const extent = Math.max(...kept.map((p) => p.x - minX), ...kept.map((p) => p.y - minY), 1);
    const scale = Math.min(1, DRAWING_MAX_COORDINATE / extent);
    if (scale < 1) note(`Se redujeron los trazos de más de ${DRAWING_MAX_COORDINATE} px de ancho o alto.`);
    const highlighter = Math.round(num(raw.opacity, 100)) === HIGHLIGHTER_OPACITY * 100;
    checkCommon(raw, highlighter);
    if (raw.strokeStyle === 'dashed' || raw.strokeStyle === 'dotted') note('El trazo punteado de líneas y trazos no tiene equivalente; se usó trazo continuo.');
    if (hex(raw.backgroundColor)) note('El relleno de líneas y trazos no se conserva.');
    return {
      ...base(raw, undefined),
      kind: 'drawing',
      name: raw.type === 'arrow' ? 'Flecha' : 'Trazo',
      layout: { x: round(minX), y: round(minY) },
      points: kept.map((p) => ({ x: round((p.x - minX) * scale), y: round((p.y - minY) * scale) })),
      strokeColor: hex(raw.strokeColor) ?? DRAWING_DEFAULT_COLOR,
      strokeWidth: Math.min(DRAWING_MAX_STROKE_WIDTH, Math.max(DRAWING_MIN_STROKE_WIDTH, num(raw.strokeWidth, DRAWING_DEFAULT_WIDTH))),
      ...(highlighter ? { highlighter: true as const } : {}),
    };
  };

  const slots: (ElementInput | undefined)[] = candidates.map(() => undefined);
  const bindable = new Map<string, string>();

  candidates.forEach(({ raw }, slot) => {
    const type = raw.type as string;
    const label = typeof raw.id === 'string' ? labels.get(raw.id) : undefined;
    let element: ElementInput | undefined;
    if (SHAPE_TYPES.includes(type)) {
      checkCommon(raw);
      const text = textOf(label);
      if (text.length > 200) note('Se recortaron los textos de formas de más de 200 caracteres.');
      const square = Math.abs(num(raw.width) - num(raw.height)) <= 1;
      const shape = type === 'diamond' ? 'diamond' : type === 'ellipse' ? (square ? 'circle' : 'oval') : square ? 'square' : 'rectangle';
      element = { ...base(raw, styleOf(raw, label)), kind: 'figure', shape, name: text.slice(0, 200) || ' ', layout: sizedLayout(raw) };
    } else if (type === 'text') {
      checkCommon(raw);
      const text = textOf(raw);
      if (text.trim() === '') note('Se omitieron textos vacíos.');
      else {
        if (text.length > TEXT_BLOCK_MAX_LENGTH) note(`Se recortaron los textos de más de ${TEXT_BLOCK_MAX_LENGTH} caracteres.`);
        element = { ...base(raw, styleOf({}, raw, false)), kind: 'text', name: text.slice(0, TEXT_BLOCK_MAX_LENGTH), layout: { x: round(num(raw.x)), y: round(num(raw.y)) } };
      }
    } else if (type === 'image') {
      checkCommon(raw);
      const file = typeof raw.fileId === 'string' ? files[raw.fileId] : undefined;
      const dataUrl = isRecord(file) && typeof file.dataURL === 'string' ? file.dataURL : undefined;
      if (!dataUrl) note('Se omitieron imágenes cuyos datos no vienen en "files".');
      else {
        try {
          element = { ...base(raw, undefined), kind: 'image', name: 'Imagen', src: sanitizeImageDataUrl(dataUrl), layout: sizedLayout(raw) };
        } catch {
          note('Se omitieron imágenes que no son PNG, JPG o SVG válidos de hasta 5 MiB.');
        }
      }
    } else if (type === 'frame' || type === 'magicframe') {
      element = { ...base(raw, undefined), kind: 'frame', name: (typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Marco').slice(0, 200), layout: sizedLayout(raw) };
    } else if (type === 'line' || type === 'freedraw') {
      element = drawingOf(raw, absolutePoints(raw));
    } else if (type !== 'arrow') {
      note(`Se omitieron los elementos de tipo "${type}", que el modelo no soporta.`);
    }
    if (element) {
      slots[slot] = element;
      if (typeof raw.id === 'string' && element.kind !== 'frame' && element.kind !== 'drawing') bindable.set(raw.id, element.id);
    }
  });

  // Las flechas van al final porque necesitan saber qué elementos se importaron.
  const relations: Relation[] = [];
  candidates.forEach(({ raw }, slot) => {
    if (raw.type !== 'arrow') return;
    const bound = (binding: unknown) => (isRecord(binding) && typeof binding.elementId === 'string' ? bindable.get(binding.elementId) : undefined);
    let source = bound(raw.startBinding);
    let target = bound(raw.endBinding);
    if (!source || !target) {
      note('Las flechas que no unen dos elementos importados se convirtieron en trazos sin conexión.');
      slots[slot] = drawingOf(raw, absolutePoints(raw));
      return;
    }
    checkCommon(raw);
    const label = labels.get(raw.id as string);
    const heads = [raw.startArrowhead, raw.endArrowhead].map((h) => (typeof h === 'string' ? h : null));
    if (heads.some((h) => h !== null && h !== 'arrow' && h !== 'triangle')) note('Las puntas de flecha especiales (rombos, círculos, barras) se importaron como punta simple.');
    // Una flecha con punta solo al inicio se invierte para que apunte al destino.
    if (heads[0] && !heads[1]) [source, target] = [target, source];
    const style = styleOf(raw, label, false);
    const text = textOf(label);
    relations.push({
      id: ids.get(raw)!,
      kind: 'connector',
      source,
      target,
      ...(text ? { label: text.slice(0, 200) } : {}),
      ...(heads[0] && heads[1] ? { arrowheads: 'both' as const } : !heads[0] && !heads[1] ? { arrowheads: 'none' as const } : {}),
      ...(raw.strokeStyle === 'dashed' || raw.strokeStyle === 'dotted' ? { dashed: true } : {}),
      ...(style ? { style } : {}),
    });
  });

  const warnings = [...notes].map(([message, count]) => (count > 1 ? `${message} (${count} elementos)` : message)).slice(0, MAX_EXCALIDRAW_WARNINGS);
  const candidate = {
    type: 'class',
    title: (title?.trim() || 'Diagrama importado').slice(0, 120),
    elements: slots.filter((e): e is ElementInput => e !== undefined),
    relations,
  };
  const checked = validateDiagram(candidate, { maxElements: MAX_EXCALIDRAW_ELEMENTS });
  if (!checked.ok) throw new DomainValidationError(checked.errors);
  return { diagram: checked.value, warnings };
}
