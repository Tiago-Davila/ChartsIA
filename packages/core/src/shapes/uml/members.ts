import { type Attribute, type Method } from '../../model/class-elements.js';
import { DEFAULT_UML_DETAIL, type UmlDetail } from '../../model/preferences.js';

export function formatAttribute(a: Attribute, uml: UmlDetail = DEFAULT_UML_DETAIL): string {
  let text = uml.visibility ? `${a.visibility} ${a.name}` : a.name;
  if (a.type && uml.types) text += `: ${a.type}`;
  if (a.defaultValue !== undefined) text += ` = ${a.defaultValue}`;
  return text;
}

export function formatMethod(m: Method, uml: UmlDetail = DEFAULT_UML_DETAIL): string {
  const params = m.parameters.map((p) => (p.type && uml.types ? `${p.name}: ${p.type}` : p.name)).join(', ');
  const name = `${m.default ? 'default ' : ''}${m.name}(${params})`;
  let text = uml.visibility ? `${m.visibility} ${name}` : name;
  if (m.returnType && uml.types) text += `: ${m.returnType}`;
  return text;
}
