export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Resuelve las entidades de un valor y falla si hay un `&` suelto o una entidad desconocida. */
function decode(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);|&/g, (match, entity: string | undefined) => {
    if (!entity) throw new Error(`"&" sin escapar en "${value}"`);
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    const char = ENTITIES[entity];
    if (char === undefined) throw new Error(`Entidad desconocida ${match}`);
    return char;
  });
}

/**
 * Lector mínimo de XML para validar la salida de los exportadores: comprueba que las etiquetas
 * se abren y cierran bien, que los atributos van entre comillas y no se repiten, y que no hay `<`
 * ni `&` sin escapar. No admite DOCTYPE, CDATA ni comentarios, que los exportadores no generan.
 */
export function parseXml(source: string): XmlNode {
  const tag = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|<\?xml[^>]*\?>|([^<]+)/g;
  const root: XmlNode = { name: '#document', attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  let position = 0;
  for (const match of source.matchAll(tag)) {
    if (match.index !== position) throw new Error(`XML mal formado cerca de: ${source.slice(position, position + 60)}`);
    position += match[0].length;
    const [whole, closing, name, rawAttrs, selfClosing, text] = match;
    if (text !== undefined) {
      if (text.trim()) throw new Error(`Texto suelto fuera de un atributo: ${text.trim().slice(0, 40)}`);
      continue;
    }
    if (whole.startsWith('<?xml')) continue;
    if (closing) {
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error(`</${name}> no cierra ${open?.name ?? 'nada'}`);
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const attr of (rawAttrs ?? '').matchAll(/([\w:.-]+)="([^"]*)"/g)) {
      if (attr[1]! in attrs) throw new Error(`Atributo repetido ${attr[1]} en <${name}>`);
      attrs[attr[1]!] = decode(attr[2]!);
    }
    const node: XmlNode = { name: name!, attrs, children: [] };
    stack[stack.length - 1]!.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (position !== source.length) throw new Error(`XML mal formado cerca de: ${source.slice(position, position + 60)}`);
  if (stack.length !== 1) throw new Error(`Etiqueta sin cerrar: ${stack[stack.length - 1]!.name}`);
  if (root.children.length !== 1) throw new Error('Debe haber un único elemento raíz');
  return root.children[0]!;
}

/** Todos los descendientes con el nombre dado, en orden de documento. */
export function findAll(node: XmlNode, name: string): XmlNode[] {
  return node.children.flatMap((child) => [...(child.name === name ? [child] : []), ...findAll(child, name)]);
}
