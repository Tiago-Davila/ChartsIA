import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from './compartments.js';

type EnumElement = ElementOfKind<'enum'>;

export function enumBox(el: EnumElement): CompartmentBox {
  return {
    header: headerLines(el.name, { stereotype: 'enumeration' }),
    sections: [el.literals.map((l, i) => ({ text: l, slot: `literal:${i}` }))],
  };
}

export const enumShape: ShapeDefinition<EnumElement> = {
  measure: (el) => measureBox(enumBox(el)),
  primitives: (el, size) => boxPrimitives(enumBox(el), size),
};
