import { type Relation } from '../../model/relation.js';
import { type Point } from '../../model/common.js';
import { COLORS, type Primitive } from '../types.js';

export type MarkerKind =
  | 'triangle-hollow'
  | 'diamond-filled'
  | 'diamond-hollow'
  | 'arrow-open'
  | 'arrow-filled';

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
export function relationStyle(rel: Pick<Relation, 'kind' | 'navigable'>): RelationStyle {
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
  }
}

/** Longitud que ocupa cada marcador a lo largo de la arista. */
export const MARKER_LENGTH: Record<MarkerKind, number> = {
  'triangle-hollow': 14,
  'diamond-filled': 20,
  'diamond-hollow': 20,
  'arrow-open': 12,
  'arrow-filled': 12,
};

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * Primitivas del marcador con la punta en `tip`, orientado según la dirección `from → tip`.
 */
export function markerPrimitives(kind: MarkerKind, tip: Point, from: Point, color: string): Primitive[] {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  // Sistema local: a lo largo (hacia atrás desde la punta) y perpendicular.
  const at = (back: number, side: number) => ({ x: r(tip.x - ux * back - uy * side), y: r(tip.y - uy * back + ux * side) });
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
