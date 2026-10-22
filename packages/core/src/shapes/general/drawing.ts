import { type ElementOfKind } from '../../model/diagram.js';
import { HIGHLIGHTER_OPACITY } from '../../model/drawing-elements.js';
import { COLORS, type PathPrimitive, type ShapeDefinition } from '../types.js';

type DrawingElement = ElementOfKind<'drawing'>;
const r = (n: number) => Math.round(n * 100) / 100;

/** Trazo libre con los puntos relativos que guarda el modelo. */
export const drawingShape: ShapeDefinition<DrawingElement> = {
  measure: (el) => {
    const padding = el.strokeWidth / 2;
    return {
      width: Math.max(1, ...el.points.map((p) => p.x)) + padding,
      height: Math.max(1, ...el.points.map((p) => p.y)) + padding,
    };
  },
  primitives: (el): PathPrimitive[] => [
    {
      type: 'path',
      d: el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`).join(' '),
      fill: 'none',
      stroke: el.strokeColor || COLORS.stroke,
      strokeWidth: el.strokeWidth,
      ...(el.highlighter ? { strokeOpacity: HIGHLIGHTER_OPACITY } : {}),
      lineCap: 'round',
      lineJoin: 'round',
    },
  ],
};
