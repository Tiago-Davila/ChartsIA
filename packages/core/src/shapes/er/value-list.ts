import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from '../uml/compartments.js';

type ValueListElement = ElementOfKind<'value-list'>;

/** Cabecera con el nombre de la lista y una fila por valor. */
export function valueListBox(el: ValueListElement): CompartmentBox {
  return {
    header: headerLines(el.name, {}),
    sections: [el.values.map((v, i) => ({ text: v, slot: `value:${i}` }))],
  };
}

/** Lista de valores ER: la misma caja de compartimentos que las tablas, con un valor por fila. */
export const valueListShape: ShapeDefinition<ValueListElement> = {
  measure: (el) => measureBox(valueListBox(el)),
  primitives: (el, size) => boxPrimitives(valueListBox(el), size),
};
