import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type ShapeDefinition } from '../types.js';

type EntityElement = ElementOfKind<'entity'>;

/** Separación entre el borde exterior y el interior de una entidad débil. */
export const WEAK_GAP = 5;
const PAD = 16;

/** Entidad ER: rectángulo con el nombre centrado; la débil lleva un segundo borde dentro. */
export const entityShape: ShapeDefinition<EntityElement> = {
  measure: (el) => {
    const font = textFont(el.style, FONT.name);
    return {
      width: Math.max(120, Math.ceil(measureText(el.name, { ...font, bold: true }) + PAD * 2 + (el.weak ? WEAK_GAP * 2 : 0))),
      height: Math.max(48, lineHeight(font.size) + 24) + (el.weak ? WEAK_GAP * 2 : 0),
    };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, { fill: COLORS.umlFill, stroke: COLORS.stroke, text: COLORS.text });
    const font = textFont(el.style, FONT.name);
    return [
      { type: 'rect', x: 0, y: 0, width, height, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth },
      ...(el.weak
        ? [{ type: 'rect' as const, x: WEAK_GAP, y: WEAK_GAP, width: width - WEAK_GAP * 2, height: height - WEAK_GAP * 2, fill: 'none', stroke: c.stroke, strokeWidth: c.strokeWidth }]
        : []),
      { type: 'text', x: width / 2, y: height / 2 + lineHeight(font.size) / 4, text: el.name, ...font, bold: true, color: c.text, anchor: 'middle', slot: 'name' },
    ];
  },
};
