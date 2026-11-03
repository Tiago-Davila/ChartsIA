import { type ElementOfKind } from '../../model/diagram.js';
import { DEFAULT_UML_DETAIL, type UmlDetail } from '../../model/preferences.js';
import { type ShapeDefinition } from '../types.js';
import { formatAttribute, formatMethod } from './members.js';
import { boxPrimitives, type CompartmentBox, headerLines, type Line, measureBox } from './compartments.js';

type EnumElement = ElementOfKind<'enum'>;

export function enumBox(el: EnumElement, uml: UmlDetail = DEFAULT_UML_DETAIL): CompartmentBox {
  const sections: Line[][] = [el.literals.map((l, i) => ({ text: l, slot: `literal:${i}` }))];
  if (el.attributes?.length) sections.push(el.attributes.map((a, i) => ({ text: formatAttribute(a, uml), slot: `attribute:${i}`, underline: a.static })));
  if (uml.methods && el.operations?.length) sections.push(el.operations.map((m, i) => ({ text: formatMethod(m, uml), slot: `operation:${i}`, underline: m.static, italic: m.abstract })));
  return { header: headerLines(el.name, { stereotype: 'enumeration' }), sections, style: el.style };
}

export const enumShape: ShapeDefinition<EnumElement> = {
  measure: (el, uml) => measureBox(enumBox(el, uml)),
  primitives: (el, size, uml) => boxPrimitives(enumBox(el, uml), size),
};
