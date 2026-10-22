import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type ShapeDefinition } from '../types.js';

type SpecializationElement = ElementOfKind<'specialization'>;

/** Ancho y alto del triángulo; el nombre va debajo, separado por LABEL_GAP. */
export const TRIANGLE_WIDTH = 48;
export const TRIANGLE_HEIGHT = 40;
const LABEL_GAP = 4;

/** Triángulo de especialización con la letra d (disjunta) u o (solapada) y el nombre debajo. */
export const specializationShape: ShapeDefinition<SpecializationElement> = {
  measure: (el) => {
    const font = textFont(el.style, FONT.name);
    return {
      width: Math.max(TRIANGLE_WIDTH, Math.ceil(measureText(el.name, font))),
      height: TRIANGLE_HEIGHT + LABEL_GAP + lineHeight(font.size),
    };
  },
  primitives: (el, { width }) => {
    const c = paintOf(el.style, { fill: COLORS.umlFill, stroke: COLORS.stroke, text: COLORS.text });
    const font = textFont(el.style, FONT.name);
    const cx = width / 2;
    const left = cx - TRIANGLE_WIDTH / 2;
    const right = cx + TRIANGLE_WIDTH / 2;
    return [
      {
        type: 'path',
        d: `M ${cx} 0 L ${right} ${TRIANGLE_HEIGHT} L ${left} ${TRIANGLE_HEIGHT} Z`,
        fill: c.fill,
        stroke: c.stroke,
        strokeWidth: c.strokeWidth,
      },
      { type: 'text', x: cx, y: TRIANGLE_HEIGHT * 0.8, text: el.overlapping ? 'o' : 'd', ...textFont(el.style, FONT.small), bold: true, color: c.text, anchor: 'middle', slot: 'kind' },
      { type: 'text', x: cx, y: TRIANGLE_HEIGHT + LABEL_GAP + lineHeight(font.size) * 0.8, text: el.name, ...font, color: c.text, anchor: 'middle', slot: 'name' },
    ];
  },
};
