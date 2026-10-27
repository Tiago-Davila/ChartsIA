import { C4_ELEMENT_KINDS, CLASS_ELEMENT_KINDS, ER_ELEMENT_KINDS, MULTIPLICITY_RELATION_KINDS, type RelationKind } from '../model/enums.js';
import { DRAWING_DEFAULT_COLOR, DRAWING_DEFAULT_WIDTH, DRAWING_MAX_COORDINATE, DRAWING_MAX_STROKE_WIDTH, DRAWING_MIN_STROKE_WIDTH } from '../model/drawing-elements.js';
import { FONT } from '../shapes/types.js';
import { canRelate } from '../validation/index.js';
import { type BuildContext, type BuiltElement } from './drawio-elements.js';
import { type RawCell, type RawPoint } from './drawio-read.js';
import { importStyle } from './drawio-style.js';
import { plainText } from './drawio-text.js';

export interface Endpoint { id: string; kind: string }
export interface RelationContext extends BuildContext {
  /** Elemento importado al que pertenece una celda (ella misma o su ancestro más cercano). */
  endpoint(cellId: string | undefined): Endpoint | undefined;
}
export interface BuiltRelation {
  fields: Record<string, unknown>;
  style?: ReturnType<typeof importStyle>;
}

const MULTIPLICITY = /^(\d+|\*)(\.\.(\d+|\*))?$/;
const CARDINALITIES: Record<string, string> = {
  ERone: 'one', ERmandOne: 'one', ERzeroToOne: 'zero-one', ERoneToMany: 'one-many', ERmany: 'zero-many', ERzeroToMany: 'zero-many',
};
const inFamily = (family: readonly string[], kind: string) => family.includes(kind);
const label = (edge: RawCell) => plainText(edge.value, edge.style.get('html') === '1').trim();

/** Tipo de relación según las puntas y el trazo de la arista y los elementos que une. */
function chooseKind(edge: RawCell, source: Endpoint, target: Endpoint): RelationKind | undefined {
  const start = edge.style.get('startArrow') ?? 'none';
  const end = edge.style.get('endArrow') ?? 'classic';
  const dashed = edge.style.get('dashed') === '1';
  if (start.startsWith('ER') || end.startsWith('ER')) return 'er-rel';
  const c4Like = (k: string) => inFamily(C4_ELEMENT_KINDS, k) || k === 'figure';
  if (end === 'blockThin' && start === 'none' && c4Like(source.kind) && c4Like(target.kind)) return 'c4-rel';
  if (source.kind === 'collection' && target.kind === 'collection' && end === 'block' && start === 'none') return 'nosql-rel';
  const uml = (k: string) => inFamily(CLASS_ELEMENT_KINDS, k);
  if (uml(source.kind) && uml(target.kind)) {
    if (start.startsWith('diamond') && end === 'none') return edge.style.get('startFill') === '1' ? 'composition' : 'aggregation';
    if (start === 'none') {
      if ((end === 'block' || end === 'triangle') && edge.style.get('endFill') === '0') return dashed ? 'realization' : 'inheritance';
      if (end === 'none') return dashed ? undefined : 'association';
      return dashed ? 'dependency' : 'association';
    }
  }
  if (inFamily(ER_ELEMENT_KINDS, source.kind) && inFamily(ER_ELEMENT_KINDS, target.kind) && start === 'none' && end === 'none' && !dashed) return 'er-attr';
  return undefined;
}

/** Multiplicidades de los extremos: celdas hijas de la arista, a la izquierda (origen) o a la derecha (destino). */
function multiplicities(edge: RawCell, ctx: RelationContext): { source?: string; target?: string } {
  const out: { source?: string; target?: string } = {};
  for (const child of ctx.children.get(edge.id) ?? []) {
    const text = label(child);
    if (!child.vertex || !text) continue;
    if (!MULTIPLICITY.test(text)) {
      ctx.warn(`Se omitió la etiqueta "${text}" de un extremo de la relación "${edge.id}": solo se importan multiplicidades como "1" o "0..*".`);
    } else if ((child.geometry?.x ?? 0) < 0) out.source = text;
    else out.target = text;
  }
  return out;
}

/** Traduce una arista con origen y destino a una relación; `undefined` si no une dos elementos importados. */
export function buildRelation(edge: RawCell, ctx: RelationContext): BuiltRelation | undefined {
  const source = ctx.endpoint(edge.source);
  const target = ctx.endpoint(edge.target);
  if (!source || !target) {
    ctx.warn(`La arista "${edge.id}" se omitió: no une dos elementos importados.`);
    return undefined;
  }
  let kind = chooseKind(edge, source, target);
  if (kind && !canRelate(kind, source.kind as never, target.kind as never)) {
    ctx.warn(`La arista "${edge.id}" no puede ser ${kind} entre ${source.kind} y ${target.kind}; se importó como conector.`);
    kind = undefined;
  }
  const start = edge.style.get('startArrow') ?? 'none';
  const end = edge.style.get('endArrow') ?? 'classic';
  const dashed = edge.style.get('dashed') === '1';
  const style = importStyle(edge.style, FONT.small);
  let text = label(edge) || edge.object?.get('c4Description')?.trim() || '';
  let technology: string | undefined;
  if (kind === 'c4-rel') {
    technology = edge.object?.get('c4Technology')?.trim();
    const tech = /(?:^|\n)\[([^\]\n]+)\]$/.exec(text);
    if (tech) {
      technology = tech[1]!.trim();
      text = text.slice(0, tech.index).trim();
    }
  }
  const base = { source: source.id, target: target.id, ...(text ? { label: ctx.clip(text, 200) } : {}) };
  if (kind === undefined) {
    const reversed = start !== 'none' && end === 'none';
    const arrowheads = start !== 'none' && end !== 'none' ? 'both' : start === 'none' && end === 'none' ? 'none' : 'end';
    return {
      fields: {
        kind: 'connector',
        ...base,
        ...(reversed ? { source: target.id, target: source.id } : {}),
        arrowheads,
        ...(dashed ? { dashed: true } : {}),
      },
      style,
    };
  }
  const ends = inFamily(MULTIPLICITY_RELATION_KINDS, kind) ? multiplicities(edge, ctx) : {};
  const fields: Record<string, unknown> = { kind, ...base };
  if (ends.source) fields.sourceMultiplicity = ends.source;
  if (ends.target) fields.targetMultiplicity = ends.target;
  if (kind === 'association' && end !== 'none') fields.navigable = 'source-to-target';
  if (kind === 'c4-rel' && technology) fields.technology = ctx.clip(technology, 120);
  if (kind === 'er-rel') {
    fields.sourceCardinality = CARDINALITIES[start] ?? 'one';
    fields.targetCardinality = CARDINALITIES[end] ?? 'one';
    if (!dashed) fields.identifying = true;
  }
  return { fields, style };
}

/** Trazo libre: una arista sin origen ni destino y sin puntas, con sus puntos relativos a su esquina. */
export function buildDrawing(edge: RawCell, ctx: BuildContext): (BuiltElement & { at: { x: number; y: number } }) | undefined {
  const geometry = edge.geometry;
  const points: RawPoint[] = [...(geometry?.sourcePoint ? [geometry.sourcePoint] : []), ...(geometry?.points ?? []), ...(geometry?.targetPoint ? [geometry.targetPoint] : [])];
  const free = (edge.style.get('startArrow') ?? 'none') === 'none' && (edge.style.get('endArrow') ?? 'classic') === 'none';
  if (points.length < 2 || !free) {
    ctx.warn(`La línea "${edge.id}" se omitió: no está unida a elementos y no es un trazo libre sin puntas.`);
    return undefined;
  }
  const parent = edge.parent ? ctx.cells.get(edge.parent) : undefined;
  const origin = parent ? ctx.abs(parent) : { x: 0, y: 0 };
  const absolute = points.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y }));
  const minX = Math.min(...absolute.map((p) => p.x));
  const minY = Math.min(...absolute.map((p) => p.y));
  const clamp = (n: number) => Math.min(DRAWING_MAX_COORDINATE, Math.max(0, Math.round(n * 100) / 100));
  const color = /^#[0-9a-fA-F]{6}$/.test(edge.style.get('strokeColor') ?? '') ? edge.style.get('strokeColor')! : DRAWING_DEFAULT_COLOR;
  const width = parseFloat(edge.style.get('strokeWidth') ?? '');
  const opacity = parseFloat(edge.style.get('opacity') ?? '');
  return {
    fields: {
      kind: 'drawing',
      name: ctx.clip(label(edge) || 'Trazo', 200),
      points: absolute.map((p) => ({ x: clamp(p.x - minX), y: clamp(p.y - minY) })),
      strokeColor: color,
      strokeWidth: Number.isFinite(width) ? Math.min(DRAWING_MAX_STROKE_WIDTH, Math.max(DRAWING_MIN_STROKE_WIDTH, width)) : DRAWING_DEFAULT_WIDTH,
      ...(Number.isFinite(opacity) && opacity < 100 ? { highlighter: true } : {}),
    },
    at: { x: Math.round(minX * 100) / 100, y: Math.round(minY * 100) / 100 },
  };
}
