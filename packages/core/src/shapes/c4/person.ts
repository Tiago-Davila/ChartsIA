import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { paintOf } from '../style.js';
import { c4Colors } from './palette.js';
import { C4_MIN_HEIGHT, c4TextHeight, c4TextPrimitives, c4Width, type C4Text } from './text-block.js';

type PersonElement = ElementOfKind<'person'>;

const HEAD = 56;
const OVERLAP = 14;

function text(el: PersonElement): C4Text {
  return { name: el.name, typeLabel: el.external ? '[Person - External]' : '[Person]', description: el.description, style: el.style };
}

/** Persona C4: cabeza circular sobre un cuerpo redondeado (`mxgraph.c4.person2`). */
export const personShape: ShapeDefinition<PersonElement> = {
  measure: (el) => {
    const width = c4Width(text(el));
    const body = Math.max(C4_MIN_HEIGHT - 10, c4TextHeight(text(el), width) + 28);
    return { width, height: HEAD - OVERLAP + body };
  },
  primitives: (el, { width, height }) => {
    const colors = paintOf(el.style, c4Colors('person', el.external));
    const bodyTop = HEAD - OVERLAP;
    return [
      { type: 'rect', x: 0, y: bodyTop, width, height: height - bodyTop, rx: 28, fill: colors.fill, stroke: colors.stroke, strokeWidth: 1.5 },
      { type: 'ellipse', cx: width / 2, cy: HEAD / 2, rx: HEAD / 2, ry: HEAD / 2, fill: colors.fill, stroke: colors.stroke, strokeWidth: 1.5 },
      ...c4TextPrimitives(text(el), { x: 0, y: bodyTop + OVERLAP, width, height: height - bodyTop - OVERLAP }, colors.text),
    ];
  },
};
