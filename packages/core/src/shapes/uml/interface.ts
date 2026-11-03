import { type ElementOfKind } from '../../model/diagram.js';
import { DEFAULT_UML_DETAIL, type UmlDetail } from '../../model/preferences.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from './compartments.js';
import { formatAttribute, formatMethod } from './members.js';

type InterfaceElement = ElementOfKind<'interface'>;

export function interfaceBox(el: InterfaceElement, uml: UmlDetail = DEFAULT_UML_DETAIL): CompartmentBox {
  const sections = [];
  if (el.attributes && el.attributes.length > 0) {
    sections.push(el.attributes.map((a, i) => ({ text: formatAttribute(a, uml), slot: `attribute:${i}`, underline: a.static })));
  }
  if (uml.methods) sections.push(el.operations.map((m, i) => ({ text: formatMethod(m, uml), slot: `operation:${i}`, italic: !m.default, underline: m.static })));
  return { header: headerLines(el.name, { stereotype: 'interface', italic: true }), sections, style: el.style };
}

export const interfaceShape: ShapeDefinition<InterfaceElement> = {
  measure: (el, uml) => measureBox(interfaceBox(el, uml)),
  primitives: (el, size, uml) => boxPrimitives(interfaceBox(el, uml), size),
};
