import { type ElementOfKind } from '../../model/diagram.js';
import { type Style } from '../../model/style.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type ShapeDefinition } from '../types.js';

type FrameElement = ElementOfKind<'frame'>;

export const FRAME_PADDING = { top: 42, right: 20, bottom: 20, left: 20 } as const;

/** Espacio interior que deja el título antes de los elementos hijos. */
export function framePadding(style?: Style) {
  const font = textFont(style, FONT.name);
  const titleBaseline = 12 + lineHeight(font.size) * 0.75;
  return { ...FRAME_PADDING, top: Math.max(FRAME_PADDING.top, Math.ceil(titleBaseline + 15)) };
}

/** Marco neutral con título y margen interior para contener cualquier elemento. */
export const frameShape: ShapeDefinition<FrameElement> = {
  padding: (el) => framePadding(el.style),
  measure: (el) => {
    const padding = framePadding(el.style);
    return {
      width: Math.max(160, Math.ceil(measureText(el.name, { ...textFont(el.style, FONT.name), bold: true }) + padding.left + padding.right)),
      height: padding.top + padding.bottom,
    };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, { fill: 'none', stroke: '#8492a6', text: COLORS.muted });
    const font = textFont(el.style, FONT.name);
    const padding = framePadding(el.style);
    return [
      { type: 'rect', x: 0, y: 0, width, height, rx: 8, fill: c.fill, stroke: c.stroke, strokeWidth: 1.5, dash: [6, 4] },
      { type: 'text', x: padding.left, y: 12 + lineHeight(font.size) * 0.75, text: el.name, ...font, bold: true, color: c.text, anchor: 'start', slot: 'name' },
    ];
  },
};
