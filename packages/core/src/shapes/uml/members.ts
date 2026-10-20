import { type Attribute, type Method } from '../../model/class-elements.js';

export function formatAttribute(a: Attribute): string {
  let text = `${a.visibility} ${a.name}`;
  if (a.type) text += `: ${a.type}`;
  if (a.defaultValue !== undefined) text += ` = ${a.defaultValue}`;
  return text;
}

export function formatMethod(m: Method): string {
  const params = m.parameters.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ');
  let text = `${m.visibility} ${m.name}(${params})`;
  if (m.returnType) text += `: ${m.returnType}`;
  return text;
}
