import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type EllipsePrimitive, type ShapeDefinition } from '../types.js';

type AttributeElement = ElementOfKind<'attribute'>;

/** Separación entre el óvalo exterior y el interior de un atributo multivaluado. */
export const MULTIVALUED_GAP = 5;
const DASH = [6, 4];
const MIN_WIDTH = 90;
const HEIGHT = 44;

/** Atributo Chen: óvalo con el nombre centrado (subrayado si es clave, doble si es multivaluado, discontinuo si es derivado). */
export const attributeShape: ShapeDefinition<AttributeElement> = {
  measure: (el) => {
    const font = textFont(el.style, FONT.member);
    const extra = el.multivalued ? MULTIVALUED_GAP * 2 : 0;
    // El texto debe caber en el rectángulo inscrito del óvalo, de ancho ~ ancho / √2.
    const text = measureText(el.name, font) * 1.4 + 20;
    return { width: Math.max(MIN_WIDTH, Math.ceil(text)) + extra, height: Math.max(HEIGHT, lineHeight(font.size) + 24) + extra };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, { fill: COLORS.umlFill, stroke: COLORS.stroke, text: COLORS.text });
    const font = textFont(el.style, FONT.member);
    const oval = (inset: number): EllipsePrimitive => ({
      type: 'ellipse',
      cx: width / 2,
      cy: height / 2,
      rx: width / 2 - inset,
      ry: height / 2 - inset,
      fill: inset === 0 ? c.fill : 'none',
      stroke: c.stroke,
      strokeWidth: 1.5,
      ...(el.derived ? { dash: DASH } : {}),
    });
    return [
      oval(0),
      ...(el.multivalued ? [oval(MULTIVALUED_GAP)] : []),
      {
        type: 'text',
        x: width / 2,
        y: height / 2 + lineHeight(font.size) / 4,
        text: el.name,
        ...font,
        color: c.text,
        anchor: 'middle',
        slot: 'name',
        ...(el.key ? { underline: true } : {}),
      },
    ];
  },
};
