import { ID_PATTERN } from '../model/common.js';
import { DiagramInputSchema, ElementSchema, type DiagramInput, type Element } from '../model/diagram.js';
import { C4_ELEMENT_KINDS, CLASS_ELEMENT_KINDS, ER_ELEMENT_KINDS, isGroupKind, type DiagramType } from '../model/enums.js';
import { RelationSchema, type Relation } from '../model/relation.js';
import { checkRules } from '../validation/index.js';
import { buildVertex, claimedCells, type BuildContext } from './drawio-elements.js';
import { drawioError } from './drawio-error.js';
import { MAX_DRAWIO_SOURCE_LENGTH, readDrawio, type RawCell } from './drawio-read.js';
import { buildDrawing, buildRelation, type RelationContext } from './drawio-relations.js';

export { MAX_DRAWIO_SOURCE_LENGTH };

export interface DrawioImportResult {
  diagram: DiagramInput;
  warnings: string[];
}

const MAX_WARNINGS = 50;
const round = (n: number) => Math.round(n * 100) / 100;

/** Tipo de diagrama según la familia de elementos que más aparece. */
function inferType(elements: Element[]): DiagramType {
  const count = (kinds: readonly string[]) => elements.filter((e) => kinds.includes(e.kind)).length;
  const families = [
    { type: 'class' as const, n: count(CLASS_ELEMENT_KINDS) },
    { type: 'c4-context' as const, n: count(C4_ELEMENT_KINDS) },
    { type: 'er' as const, n: count(ER_ELEMENT_KINDS) },
    { type: 'nosql' as const, n: count(['collection']) },
  ];
  const best = families.reduce((a, b) => (b.n > a.n ? b : a));
  if (best.type !== 'c4-context') return best.n === 0 ? 'class' : best.type;
  if (elements.some((e) => e.kind === 'component')) return 'c4-component';
  return elements.some((e) => e.kind === 'container') ? 'c4-container' : 'c4-context';
}

/** Importa un `.drawio` (sin comprimir o comprimido) o un `mxGraphModel` suelto al modelo canónico, con avisos de lo que no se pudo traducir. */
export async function importDrawio(source: string, title?: string): Promise<DrawioImportResult> {
  const page = await readDrawio(source);
  const warnings: string[] = [];
  const warn = (message: string) => {
    if (warnings.length < MAX_WARNINGS && !warnings.includes(message)) warnings.push(message);
  };
  if (page.skipped.length > 0) {
    warn(`El archivo tiene ${page.skipped.length + 1} páginas: se importó solo la primera${page.name ? ` ("${page.name}")` : ''} y se omitieron ${page.skipped.map((n) => `"${n}"`).join(', ')}.`);
  }

  const cells = new Map(page.cells.map((cell) => [cell.id, cell]));
  const children = new Map<string, RawCell[]>();
  for (const cell of page.cells) {
    if (cell.parent) children.set(cell.parent, [...(children.get(cell.parent) ?? []), cell]);
  }
  let clipped = false;
  const ctx: BuildContext = {
    cells,
    children,
    warn,
    clip(text, max) {
      if (text.length <= max) return text;
      if (!clipped) warn('Se recortaron textos que superaban el máximo del modelo.');
      clipped = true;
      return text.slice(0, max);
    },
    abs(cell) {
      let x = 0;
      let y = 0;
      const seen = new Set<string>();
      for (let cur: RawCell | undefined = cell; cur && !seen.has(cur.id); cur = cur.parent ? cells.get(cur.parent) : undefined) {
        seen.add(cur.id);
        if (cur.vertex && cur.geometry) {
          x += cur.geometry.x;
          y += cur.geometry.y;
        }
      }
      return { x, y };
    },
  };

  const used = new Set(page.cells.map((cell) => cell.id).filter((id) => ID_PATTERN.test(id)));
  let counter = 0;
  const modelId = (raw: string, prefix: string) => {
    if (ID_PATTERN.test(raw)) return raw;
    let id = prefix + ++counter;
    while (used.has(id)) id = prefix + ++counter;
    used.add(id);
    return id;
  };

  const elements: Element[] = [];
  const elementOfCell = new Map<string, Element>();
  const parentCell = new Map<string, RawCell | undefined>();
  const addElement = (cell: RawCell, candidate: Record<string, unknown>) => {
    const parsed = ElementSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      warn(`El elemento "${cell.id}" no es válido (${issue.path.join('/') || 'raíz'}: ${issue.message}) y se omitió.`);
      return;
    }
    elements.push(parsed.data);
    elementOfCell.set(cell.id, parsed.data);
    parentCell.set(cell.id, cell.parent ? cells.get(cell.parent) : undefined);
  };

  const claimed = claimedCells(page.cells, children);
  for (const cell of page.cells) {
    if (!cell.vertex || !cell.geometry || claimed.has(cell.id)) continue;
    const built = buildVertex(cell, ctx);
    if (!built) continue;
    const at = built.at ?? ctx.abs(cell);
    const { width, height } = cell.geometry;
    const sized = built.sized && width > 0 && height > 0;
    addElement(cell, {
      id: modelId(cell.id, 'E'),
      ...built.fields,
      layout: { x: round(at.x), y: round(at.y), ...(sized ? { width: round(width), height: round(height), resized: true } : {}) },
      ...(built.style ? { style: built.style } : {}),
    });
  }

  const endpoint: RelationContext['endpoint'] = (cellId) => {
    const seen = new Set<string>();
    for (let cur = cellId ? cells.get(cellId) : undefined; cur && !seen.has(cur.id); cur = cur.parent ? cells.get(cur.parent) : undefined) {
      seen.add(cur.id);
      const element = elementOfCell.get(cur.id);
      if (element) return { id: element.id, kind: element.kind };
    }
    return undefined;
  };
  const relationCtx: RelationContext = { ...ctx, endpoint };
  const relations: Relation[] = [];
  for (const cell of page.cells) {
    if (!cell.edge || claimed.has(cell.id)) continue;
    if (!cell.source && !cell.target) {
      const drawing = buildDrawing(cell, ctx);
      if (drawing) addElement(cell, { id: modelId(cell.id, 'E'), ...drawing.fields, layout: drawing.at });
      continue;
    }
    const built = buildRelation(cell, relationCtx);
    if (!built) continue;
    const parsed = RelationSchema.safeParse({ id: modelId(cell.id, 'R'), ...built.fields, ...(built.style ? { style: built.style } : {}) });
    if (parsed.success) relations.push(parsed.data);
    else warn(`La relación "${cell.id}" no es válida (${parsed.error.issues[0]!.message}) y se omitió.`);
  }

  for (const [cellId, element] of elementOfCell) {
    const seen = new Set<string>();
    for (let cur = parentCell.get(cellId); cur && !seen.has(cur.id); cur = cur.parent ? cells.get(cur.parent) : undefined) {
      seen.add(cur.id);
      const parent = elementOfCell.get(cur.id);
      if (parent && isGroupKind(parent.kind)) {
        element.parentId = parent.id;
        break;
      }
    }
  }
  if (elements.length === 0) {
    throw drawioError('SCHEMA_VIOLATION', 'El diagrama no contiene elementos que se puedan importar.', 'Revisa que el archivo tenga formas de draw.io (rectángulos, clases, elementos C4…) y no solo texto o imágenes externas.');
  }

  let repaired = relations;
  let fixed = elements;
  for (let pass = 0; pass < 4; pass++) {
    const errors = checkRules({ type: inferType(fixed), elements: fixed, relations: repaired });
    if (errors.length === 0) break;
    const dropRelations = new Set<number>();
    const unparent = new Set<number>();
    for (const error of errors) {
      const relation = /^\/relations\/(\d+)/.exec(error.path);
      const parent = /^\/elements\/(\d+)\/parentId$/.exec(error.path);
      if (relation) dropRelations.add(Number(relation[1]));
      else if (parent) unparent.add(Number(parent[1]));
      else if (error.code === 'LIMIT_EXCEEDED') throw drawioError('LIMIT_EXCEEDED', error.message, error.hint);
      else throw drawioError('SCHEMA_VIOLATION', 'El contenido importado no cumple el modelo: ' + error.message, error.hint);
    }
    if (dropRelations.size + unparent.size === 0) break;
    for (const i of dropRelations) warn(`Se omitió la relación "${repaired[i]!.id}": ${errors.find((e) => e.path.startsWith(`/relations/${i}`))!.message}`);
    repaired = repaired.filter((_, i) => !dropRelations.has(i));
    fixed = fixed.map((element, i) => {
      if (!unparent.has(i)) return element;
      if (element.kind === 'component') {
        warn(`El componente C4 "${element.name}" no está dentro de un límite de tipo container; se importó como contenedor.`);
        const { parentId: _kept, ...rest } = element;
        return { ...rest, kind: 'container' as const };
      }
      warn(`El elemento "${element.name}" no puede estar dentro de su grupo y se importó sin padre.`);
      const { parentId: _dropped, ...rest } = element;
      return rest as Element;
    });
  }

  const diagramTitle = (title?.trim() || page.name.trim() || 'Diagrama importado').slice(0, 120);
  const parsed = DiagramInputSchema.safeParse({ type: inferType(fixed), title: diagramTitle, elements: fixed, relations: repaired });
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw drawioError('SCHEMA_VIOLATION', 'El modelo resultante no es válido: ' + issue.path.join('/') + ': ' + issue.message + '.', 'Revisa el elemento indicado en el archivo de draw.io.');
  }
  return { diagram: parsed.data, warnings };
}
