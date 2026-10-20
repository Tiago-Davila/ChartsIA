// Caracteres no permitidos en XML 1.0 (controles salvo tab, LF y CR) y sustitutos sueltos.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/**
 * Escapa texto para contenido o atributos XML/SVG. Nunca se emiten DOCTYPE ni entidades
 * propias: el resultado solo usa las cinco entidades predefinidas.
 */
export function escapeXml(value: string): string {
  return value.replace(INVALID_XML, '').replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

/** Atributo XML donde los saltos de línea se conservan como referencia numérica. */
export function escapeXmlAttr(value: string): string {
  return escapeXml(value).replace(/\r?\n/g, '&#xa;');
}

/** Construye un elemento XML; los atributos `undefined` se omiten. */
export function xmlElement(name: string, attrs: Record<string, string | number | undefined>, children?: string): string {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeXmlAttr(String(v))}"`)
    .join('');
  return children === undefined ? `<${name}${a}/>` : `<${name}${a}>${children}</${name}>`;
}
