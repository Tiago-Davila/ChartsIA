import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from './compartments.js';
import { formatAttribute, formatMethod } from './members.js';

type InterfaceElement = ElementOfKind<'interface'>;

export function interfaceBox(el: InterfaceElement): CompartmentBox {
  const sections = [];
  if (el.attributes && el.attributes.length > 0) {
    sections.push(el.attributes.map((a, i) => ({ text: formatAttribute(a), slot: `attribute:${i}`, underline: a.static })));
  }
  sections.push(el.operations.map((m, i) => ({ text: formatMethod(m), slot: `operation:${i}`, italic: !m.default, underline: m.static })));
  return { header: headerLines(el.name, { stereotype: 'interface', italic: true }), sections };
}

export const interfaceShape: ShapeDefinition<InterfaceElement> = {
  measure: (el) => measureBox(interfaceBox(el)),
  primitives: (el, size) => boxPrimitives(interfaceBox(el), size),
};
