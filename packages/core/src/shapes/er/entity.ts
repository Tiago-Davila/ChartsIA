import { type ElementOfKind } from '../../model/diagram.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type ShapeDefinition } from '../types.js';

type EntityElement = ElementOfKind<'entity'>;

/** Separación entre el borde exterior y el interior de una entidad débil. */
export const WEAK_GAP = 5;
const PAD = 16;

/** Entidad ER: rectángulo con el nombre centrado; la débil lleva un segundo borde dentro. */
export const entityShape: ShapeDefinition<EntityElement> = {
  measure: (el) => ({
    width: Math.max(120, Math.ceil(measureText(el.name, { size: FONT.name, bold: true }) + PAD * 2 + (el.weak ? WEAK_GAP * 2 : 0))),
    height: 48 + (el.weak ? WEAK_GAP * 2 : 0),
  }),
  primitives: (el, { width, height }) => [
    { type: 'rect', x: 0, y: 0, width, height, fill: COLORS.umlFill, stroke: COLORS.stroke, strokeWidth: 1.5 },
    ...(el.weak
      ? [{ type: 'rect' as const, x: WEAK_GAP, y: WEAK_GAP, width: width - WEAK_GAP * 2, height: height - WEAK_GAP * 2, fill: 'none', stroke: COLORS.stroke, strokeWidth: 1.5 }]
      : []),
    { type: 'text', x: width / 2, y: height / 2 + lineHeight(FONT.name) / 4, text: el.name, size: FONT.name, bold: true, color: COLORS.text, anchor: 'middle', slot: 'name' },
  ],
};
