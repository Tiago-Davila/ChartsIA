import { type Cardinality } from '../../model/enums.js';
import { type Relation } from '../../model/relation.js';
import { type Point } from '../../model/common.js';
import { COLORS, type Primitive } from '../types.js';

export type MarkerKind =
  | 'triangle-hollow'
  | 'diamond-filled'
  | 'diamond-hollow'
  | 'arrow-open'
  | 'arrow-filled'
  | Cardinality;

export interface RelationStyle {
  color: string;
  dash?: number[];
  /** Marcador en el extremo `source`. */
  start?: MarkerKind;
  /** Marcador en el extremo `target`. */
  end?: MarkerKind;
}

const DASH = [6, 4];

/**
 * Notación de cada relación. En composición y agregación el rombo va en el extremo del
 * "todo", que en el modelo es `source` (p. ej. Pedido ◆— LineaPedido).
 */
export function relationStyle(rel: Pick<Relation, 'kind' | 'navigable' | 'sourceCardinality' | 'targetCardinality' | 'identifying' | 'arrowheads' | 'dashed'>): RelationStyle {
  switch (rel.kind) {
    case 'inheritance':
      return { color: COLORS.edge, end: 'triangle-hollow' };
    case 'realization':
      return { color: COLORS.edge, dash: DASH, end: 'triangle-hollow' };
    case 'composition':
      return { color: COLORS.edge, start: 'diamond-filled' };
    case 'aggregation':
      return { color: COLORS.edge, start: 'diamond-hollow' };
    case 'dependency':
      return { color: COLORS.edge, dash: DASH, end: 'arrow-open' };
    case 'association':
      if (rel.navigable === 'source-to-target') return { color: COLORS.edge, end: 'arrow-open' };
      return { color: COLORS.edge };
    case 'c4-rel':
      return { color: '#707070', dash: DASH, end: 'arrow-filled' };
    case 'er-attr':
      return { color: COLORS.edge };
    case 'connector': {
      const heads = rel.arrowheads ?? 'end';
      return {
        color: COLORS.edge,
        ...(rel.dashed ? { dash: DASH } : {}),
        ...(heads === 'both' ? { start: 'arrow-open' as const } : {}),
        ...(heads !== 'none' ? { end: 'arrow-open' as const } : {}),
      };
    }
    case 'er-rel':
      return { color: COLORS.edge, ...(rel.identifying ? {} : { dash: DASH }), start: rel.sourceCardinality, end: rel.targetCardinality };
  }
}

/** Longitud que ocupa cada marcador a lo largo de la arista. */
export const MARKER_LENGTH: Record<MarkerKind, number> = {
  'triangle-hollow': 14,
  'diamond-filled': 20,
  'diamond-hollow': 20,
  'arrow-open': 12,
  'arrow-filled': 12,
  one: 12,
  'zero-one': 22,
  'one-many': 18,
  'zero-many': 22,
};

const r = (n: number) => Math.round(n * 100) / 100;

export type Frame = (back: number, side: number) => Point;

/** Sistema local de un marcador: a lo largo (hacia atrás desde la punta) y perpendicular. */
export function markerFrame(tip: Point, from: Point): Frame {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  return (back, side) => ({ x: r(tip.x - ux * back - uy * side), y: r(tip.y - uy * back + ux * side) });
}

export const CIRCLE_RADIUS = 5;
const CARDINALITIES_SET = new Set<string>(['one', 'zero-one', 'one-many', 'zero-many']);

export function isCardinality(kind: MarkerKind): kind is Cardinality {
  return CARDINALITIES_SET.has(kind);
}

/** Trazos y círculo (centro) de una marca pata de gallo con la punta en `at(0, 0)`. */
export function crowFoot(kind: Cardinality, at: Frame): { lines: [Point, Point][]; circle?: Point } {
  const bar = (back: number): [Point, Point] => [at(back, -7), at(back, 7)];
  const foot: [Point, Point][] = [[at(12, 0), at(0, -8)], [at(12, 0), at(0, 0)], [at(12, 0), at(0, 8)]];
  switch (kind) {
    case 'one':
      return { lines: [bar(4), bar(10)] };
    case 'zero-one':
      return { lines: [bar(4)], circle: at(14, 0) };
    case 'one-many':
      return { lines: [...foot, bar(16)] };
    case 'zero-many':
      return { lines: foot, circle: at(17, 0) };
  }
}

/** Primitivas del marcador con la punta en `tip`, orientado según la dirección `from → tip`. */
export function markerPrimitives(kind: MarkerKind, tip: Point, from: Point, color: string): Primitive[] {
  const at = markerFrame(tip, from);
  if (isCardinality(kind)) {
    const { lines, circle } = crowFoot(kind, at);
    const stroke = { stroke: color, strokeWidth: 1.5 };
    return [
      ...lines.map((l): Primitive => ({ type: 'path', d: `M ${l[0].x} ${l[0].y} L ${l[1].x} ${l[1].y}`, fill: 'none', ...stroke })),
      ...(circle ? [{ type: 'ellipse' as const, cx: circle.x, cy: circle.y, rx: CIRCLE_RADIUS, ry: CIRCLE_RADIUS, fill: '#ffffff', ...stroke }] : []),
    ];
  }
  const poly = (pts: Point[], fill: string): Primitive => ({
    type: 'path',
    d: `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`,
    fill,
    stroke: color,
    strokeWidth: 1.5,
  });
  switch (kind) {
    case 'triangle-hollow':
      return [poly([at(0, 0), at(14, 8), at(14, -8)], '#ffffff')];
    case 'diamond-filled':
      return [poly([at(0, 0), at(10, 6), at(20, 0), at(10, -6)], color)];
    case 'diamond-hollow':
      return [poly([at(0, 0), at(10, 6), at(20, 0), at(10, -6)], '#ffffff')];
    case 'arrow-filled':
      return [poly([at(0, 0), at(12, 6), at(12, -6)], color)];
    case 'arrow-open': {
      const a = at(12, 7);
      const b = at(12, -7);
      const t = at(0, 0);
      return [{ type: 'path', d: `M ${a.x} ${a.y} L ${t.x} ${t.y} L ${b.x} ${b.y}`, fill: 'none', stroke: color, strokeWidth: 1.5 }];
    }
  }
}
