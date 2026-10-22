import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from './compartments.js';
import { formatAttribute, formatMethod } from './members.js';

type ClassElement = ElementOfKind<'class'>;

export function classBox(el: ClassElement): CompartmentBox {
  return {
    header: headerLines(el.name, { stereotype: el.stereotype, italic: el.abstract, abstract: el.abstract }),
    style: el.style,
    sections: [
      el.attributes.map((a, i) => ({ text: formatAttribute(a), slot: `attribute:${i}`, underline: a.static })),
      el.operations.map((m, i) => ({ text: formatMethod(m), slot: `operation:${i}`, underline: m.static, italic: m.abstract })),
    ],
  };
}

/** Clase UML de tres compartimentos (inspirada en `mxUML25` de draw.io). */
export const classShape: ShapeDefinition<ClassElement> = {
  measure: (el) => measureBox(classBox(el)),
  primitives: (el, size) => boxPrimitives(classBox(el), size),
};
