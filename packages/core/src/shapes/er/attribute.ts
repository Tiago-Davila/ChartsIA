import { type ElementOfKind } from '../../model/diagram.js';
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
    const extra = el.multivalued ? MULTIVALUED_GAP * 2 : 0;
    // El texto debe caber en el rectángulo inscrito del óvalo, de ancho ~ ancho / √2.
    const text = measureText(el.name, { size: FONT.member }) * 1.4 + 20;
    return { width: Math.max(MIN_WIDTH, Math.ceil(text)) + extra, height: HEIGHT + extra };
  },
  primitives: (el, { width, height }) => {
    const oval = (inset: number): EllipsePrimitive => ({
      type: 'ellipse',
      cx: width / 2,
      cy: height / 2,
      rx: width / 2 - inset,
      ry: height / 2 - inset,
      fill: inset === 0 ? COLORS.umlFill : 'none',
      stroke: COLORS.stroke,
      strokeWidth: 1.5,
      ...(el.derived ? { dash: DASH } : {}),
    });
    return [
      oval(0),
      ...(el.multivalued ? [oval(MULTIVALUED_GAP)] : []),
      {
        type: 'text',
        x: width / 2,
        y: height / 2 + lineHeight(FONT.member) / 4,
        text: el.name,
        size: FONT.member,
        color: COLORS.text,
        anchor: 'middle',
        slot: 'name',
        ...(el.key ? { underline: true } : {}),
      },
    ];
  },
};
