import { drawioError } from './drawio-error.js';

export const MAX_XML_DEPTH = 64;
export const MAX_XML_NODES = 200_000;
const MAX_XML_ATTRIBUTES = 1_000;

export interface XmlNode {
  name: string;
  attrs: Map<string, string>;
  children: XmlNode[];
  text: string;
}

const HINT = 'Revisa que el contenido sea un archivo .drawio o un mxGraphModel completo, tal como lo exporta o copia draw.io.';

function syntax(message: string): never {
  throw drawioError('SCHEMA_VIOLATION', 'XML mal formado: ' + message + '.', HINT);
}

/** Decodifica solo las cinco entidades predefinidas y las referencias numéricas; nunca resuelve entidades propias. */
function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/g, (match, body: string) => {
    if (body === 'amp') return '&';
    if (body === 'lt') return '<';
    if (body === 'gt') return '>';
    if (body === 'quot') return '"';
    if (body === 'apos') return "'";
    const code = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) || code === 0) return match;
    return String.fromCodePoint(code);
  });
}

/** Lee una etiqueta de apertura desde `start` (justo tras `<`) y devuelve el nodo y la posición siguiente. */
function readOpenTag(source: string, start: number): { node: XmlNode; end: number; selfClosing: boolean } {
  let i = start;
  while (i < source.length && !/[\s/>]/.test(source[i]!)) i++;
  const name = source.slice(start, i);
  if (!name) syntax('etiqueta sin nombre');
  const attrs = new Map<string, string>();
  for (;;) {
    while (i < source.length && /\s/.test(source[i]!)) i++;
    if (i >= source.length) syntax('etiqueta sin cerrar');
    if (source[i] === '>') return { node: { name, attrs, children: [], text: '' }, end: i + 1, selfClosing: false };
    if (source.startsWith('/>', i)) return { node: { name, attrs, children: [], text: '' }, end: i + 2, selfClosing: true };
    const nameStart = i;
    while (i < source.length && !/[\s=/>]/.test(source[i]!)) i++;
    const attr = source.slice(nameStart, i);
    if (!attr) syntax('atributo sin nombre en <' + name + '>');
    while (i < source.length && /\s/.test(source[i]!)) i++;
    if (source[i] !== '=') syntax('el atributo ' + attr + ' no tiene valor');
    i++;
    while (i < source.length && /\s/.test(source[i]!)) i++;
    const quote = source[i];
    if (quote !== '"' && quote !== "'") syntax('el valor de ' + attr + ' no está entre comillas');
    const close = source.indexOf(quote, i + 1);
    if (close < 0) syntax('comillas sin cerrar en ' + attr);
    if (attrs.size >= MAX_XML_ATTRIBUTES) throw drawioError('LIMIT_EXCEEDED', 'Una etiqueta XML supera el máximo de ' + MAX_XML_ATTRIBUTES + ' atributos.', HINT);
    attrs.set(attr, decodeEntities(source.slice(i + 1, close)));
    i = close + 1;
  }
}

/** Parser XML mínimo y seguro: rechaza DOCTYPE y entidades propias, no abre recursos externos y acota profundidad y nodos. */
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: '#document', attrs: new Map(), children: [], text: '' };
  const stack: XmlNode[] = [root];
  let nodes = 0;
  let i = 0;
  while (i < source.length) {
    const lt = source.indexOf('<', i);
    const top = stack[stack.length - 1]!;
    if (lt < 0) {
      top.text += decodeEntities(source.slice(i));
      break;
    }
    if (lt > i) top.text += decodeEntities(source.slice(i, lt));
    i = lt;
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      if (end < 0) syntax('comentario sin cerrar');
      i = end + 3;
    } else if (source.startsWith('<![CDATA[', i)) {
      const end = source.indexOf(']]>', i + 9);
      if (end < 0) syntax('CDATA sin cerrar');
      top.text += source.slice(i + 9, end);
      i = end + 3;
    } else if (source.startsWith('<?', i)) {
      const end = source.indexOf('?>', i + 2);
      if (end < 0) syntax('instrucción sin cerrar');
      i = end + 2;
    } else if (source.startsWith('<!', i)) {
      throw drawioError(
        'SCHEMA_VIOLATION',
        'El XML contiene una declaración <!…> (DOCTYPE o ENTITY), que no se admite por seguridad.',
        'Exporta de nuevo el diagrama desde draw.io (Archivo > Exportar como > XML) y pega el resultado sin declaraciones DTD.',
      );
    } else if (source.startsWith('</', i)) {
      const end = source.indexOf('>', i);
      if (end < 0) syntax('etiqueta de cierre sin terminar');
      const name = source.slice(i + 2, end).trim();
      if (stack.length <= 1 || top.name !== name) syntax('el cierre </' + name + '> no corresponde a ninguna etiqueta abierta');
      stack.pop();
      i = end + 1;
    } else {
      if (++nodes > MAX_XML_NODES) throw drawioError('LIMIT_EXCEEDED', 'El XML supera el máximo de ' + MAX_XML_NODES + ' etiquetas.', 'Divide el diagrama en varios más pequeños.');
      const { node, end, selfClosing } = readOpenTag(source, i + 1);
      top.children.push(node);
      i = end;
      if (!selfClosing) {
        if (stack.length > MAX_XML_DEPTH) throw drawioError('LIMIT_EXCEEDED', 'El XML supera la profundidad máxima de ' + MAX_XML_DEPTH + ' niveles.', HINT);
        stack.push(node);
      }
    }
  }
  if (stack.length !== 1) syntax('hay etiquetas sin cerrar');
  return root;
}
