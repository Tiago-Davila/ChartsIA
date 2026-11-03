import { type ElementOfKind } from '../../model/diagram.js';
import { DEFAULT_UML_DETAIL, type UmlDetail } from '../../model/preferences.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from './compartments.js';
import { formatAttribute, formatMethod } from './members.js';

type ClassElement = ElementOfKind<'class'>;

export function classBox(el: ClassElement, uml: UmlDetail = DEFAULT_UML_DETAIL): CompartmentBox {
  return {
    header: headerLines(el.name, { stereotype: el.stereotype, italic: el.abstract, abstract: el.abstract }),
    style: el.style,
    sections: [
      el.attributes.map((a, i) => ({ text: formatAttribute(a, uml), slot: `attribute:${i}`, underline: a.static })),
      ...(uml.methods ? [el.operations.map((m, i) => ({ text: formatMethod(m, uml), slot: `operation:${i}`, underline: m.static, italic: m.abstract }))] : []),
    ],
  };
}

/** Clase UML de tres compartimentos (inspirada en `mxUML25` de draw.io). */
export const classShape: ShapeDefinition<ClassElement> = {
  measure: (el, uml) => measureBox(classBox(el, uml)),
  primitives: (el, size, uml) => boxPrimitives(classBox(el, uml), size),
};
