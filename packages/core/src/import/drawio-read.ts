import { isDomainValidationError } from '../validation/errors.js';
import { drawioError } from './drawio-error.js';
import { parseXml, type XmlNode } from './xml.js';

export const MAX_DRAWIO_SOURCE_LENGTH = 4 * 1024 * 1024;
const MAX_INFLATED_BYTES = 32 * 1024 * 1024;
export const MAX_DRAWIO_CELLS = 20_000;

export interface RawPoint { x: number; y: number }
export interface RawGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  points: RawPoint[];
  sourcePoint?: RawPoint;
  targetPoint?: RawPoint;
}
/** Celda de draw.io ya leída: estilo como mapa y atributos de `object`/`UserObject` aparte. */
export interface RawCell {
  id: string;
  parent?: string;
  value: string;
  style: Map<string, string>;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  geometry?: RawGeometry;
  object?: Map<string, string>;
}
export interface RawPage {
  name: string;
  cells: RawCell[];
  /** Nombres de las páginas que no se importaron. */
  skipped: string[];
}

const HINT = 'Exporta el diagrama desde draw.io (Archivo > Exportar como > XML) o copia las formas en draw.io y pégalas aquí.';

/** Convierte un texto de estilo "a=b;c;d=e" en un mapa; las claves sueltas (p. ej. "ellipse") quedan con valor vacío. */
export function parseStyle(style: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of (style ?? '').split(';')) {
    const token = part.trim();
    if (!token) continue;
    const eq = token.indexOf('=');
    if (eq < 0) map.set(token, '');
    else map.set(token.slice(0, eq), token.slice(eq + 1));
  }
  return map;
}

const num = (value: string | undefined): number => {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
};

/** Descomprime bytes deflate; falla si el resultado supera el máximo permitido. */
async function inflate(bytes: Uint8Array<ArrayBuffer>, format: 'deflate-raw' | 'deflate'): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_INFLATED_BYTES) {
      await reader.cancel();
      throw drawioError('LIMIT_EXCEEDED', 'El diagrama comprimido supera el máximo de ' + MAX_INFLATED_BYTES / 1024 / 1024 + ' MiB descomprimido.', 'Divide el diagrama en varios más pequeños.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Texto de un `<diagram>` comprimido por draw.io: base64 de un deflate crudo del XML codificado como URL. */
async function decodePayload(payload: string): Promise<string> {
  const clean = payload.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw drawioError('SCHEMA_VIOLATION', 'El contenido del diagrama no es XML ni está comprimido en base64.', HINT);
  }
  if (typeof DecompressionStream === 'undefined') {
    throw drawioError('SCHEMA_VIOLATION', 'Este entorno no puede descomprimir diagramas de draw.io.', 'Exporta el diagrama sin comprimir: Archivo > Propiedades > Comprimido desactivado.');
  }
  let inflated: Uint8Array;
  try {
    const bytes = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
    inflated = await inflate(bytes, 'deflate-raw').catch((error: unknown) => {
      if (isDomainValidationError(error)) throw error;
      return inflate(bytes, 'deflate');
    });
  } catch (error) {
    if (isDomainValidationError(error)) throw error;
    throw drawioError('SCHEMA_VIOLATION', 'No se pudo descomprimir el diagrama: los datos están dañados.', HINT);
  }
  const text = new TextDecoder('utf-8').decode(inflated);
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function readPoint(node: XmlNode): RawPoint {
  return { x: num(node.attrs.get('x')), y: num(node.attrs.get('y')) };
}

function readGeometry(node: XmlNode | undefined): RawGeometry | undefined {
  if (!node) return undefined;
  const geometry: RawGeometry = {
    x: num(node.attrs.get('x')),
    y: num(node.attrs.get('y')),
    width: num(node.attrs.get('width')),
    height: num(node.attrs.get('height')),
    points: [],
  };
  for (const child of node.children) {
    const as = child.attrs.get('as');
    if (child.name === 'Array' && as === 'points') geometry.points = child.children.filter((p) => p.name === 'mxPoint').map(readPoint);
    else if (child.name === 'mxPoint' && as === 'sourcePoint') geometry.sourcePoint = readPoint(child);
    else if (child.name === 'mxPoint' && as === 'targetPoint') geometry.targetPoint = readPoint(child);
  }
  return geometry;
}

/** Lee una celda `mxCell`, o un `object`/`UserObject` que la envuelve; ignora cualquier otra etiqueta. */
function readCell(node: XmlNode): RawCell | undefined {
  const wrapped = node.name === 'object' || node.name === 'UserObject';
  if (!wrapped && node.name !== 'mxCell') return undefined;
  const cell = wrapped ? node.children.find((c) => c.name === 'mxCell') : node;
  const id = node.attrs.get('id');
  if (!cell || !id) return undefined;
  const object = wrapped ? new Map([...node.attrs].filter(([key]) => key !== 'id')) : undefined;
  let value = wrapped ? (node.attrs.get('label') ?? '') : (cell.attrs.get('value') ?? '');
  if (object?.get('placeholders') === '1') value = value.replace(/%([^%\s]+)%/g, (match, key: string) => object.get(key) ?? match);
  const parent = cell.attrs.get('parent');
  const source = cell.attrs.get('source');
  const target = cell.attrs.get('target');
  const geometry = readGeometry(cell.children.find((c) => c.name === 'mxGeometry'));
  return {
    id,
    ...(parent ? { parent } : {}),
    value,
    style: parseStyle(cell.attrs.get('style')),
    vertex: cell.attrs.get('vertex') === '1',
    edge: cell.attrs.get('edge') === '1',
    ...(source ? { source } : {}),
    ...(target ? { target } : {}),
    ...(geometry ? { geometry } : {}),
    ...(object ? { object } : {}),
  };
}

function readModel(model: XmlNode): RawCell[] {
  const root = model.children.find((c) => c.name === 'root');
  if (!root) throw drawioError('SCHEMA_VIOLATION', 'El mxGraphModel no tiene <root>.', HINT);
  if (root.children.length > MAX_DRAWIO_CELLS) {
    throw drawioError('LIMIT_EXCEEDED', 'El diagrama tiene más de ' + MAX_DRAWIO_CELLS + ' celdas.', 'Divide el diagrama en varios más pequeños.');
  }
  const seen = new Set<string>();
  const cells: RawCell[] = [];
  for (const node of root.children) {
    const cell = readCell(node);
    if (!cell || seen.has(cell.id)) continue;
    seen.add(cell.id);
    cells.push(cell);
  }
  return cells;
}

/** Devuelve el `mxGraphModel` de una página, ya sea en claro dentro de `<diagram>` o comprimido. */
async function modelOf(diagram: XmlNode): Promise<XmlNode> {
  const inline = diagram.children.find((c) => c.name === 'mxGraphModel');
  if (inline) return inline;
  const payload = diagram.text.trim();
  if (!payload) throw drawioError('SCHEMA_VIOLATION', 'La página "' + (diagram.attrs.get('name') ?? '') + '" está vacía.', HINT);
  const xml = payload.startsWith('<') ? payload : await decodePayload(payload);
  const model = parseXml(xml).children.find((c) => c.name === 'mxGraphModel');
  if (!model) throw drawioError('SCHEMA_VIOLATION', 'La página comprimida no contiene un mxGraphModel.', HINT);
  return model;
}

/** Normaliza lo pegado: quita BOM y espacios y decodifica el texto cuando draw.io lo copia como URL. */
function normalize(source: string): string {
  let text = (source.charCodeAt(0) === 0xfeff ? source.slice(1) : source).trim();
  if (/^%3C/i.test(text)) {
    try {
      text = decodeURIComponent(text).trim();
    } catch {
      return text;
    }
  }
  return text;
}

/** Lee un `.drawio` o un `mxGraphModel` (sin comprimir o comprimido) y devuelve la primera página. */
export async function readDrawio(source: string): Promise<RawPage> {
  if (typeof source !== 'string') throw drawioError('SCHEMA_VIOLATION', 'La entrada draw.io debe ser texto.', HINT);
  if (source.length > MAX_DRAWIO_SOURCE_LENGTH) {
    throw drawioError('LIMIT_EXCEEDED', 'El texto supera el máximo de ' + MAX_DRAWIO_SOURCE_LENGTH / 1024 / 1024 + ' Mi caracteres.', 'Importa un diagrama más pequeño o divídelo en varios.');
  }
  const text = normalize(source);
  if (!text) throw drawioError('SCHEMA_VIOLATION', 'No hay contenido para importar.', HINT);
  const document = parseXml(text.startsWith('<') ? text : await decodePayload(text));
  const top = document.children.find((c) => ['mxfile', 'mxGraphModel', 'diagram'].includes(c.name));
  if (!top) {
    throw drawioError('SCHEMA_VIOLATION', 'El XML no es un archivo de draw.io: se esperaba <mxfile> o <mxGraphModel>.', HINT);
  }
  if (top.name === 'mxGraphModel') return { name: '', cells: readModel(top), skipped: [] };
  const pages = top.name === 'mxfile' ? top.children.filter((c) => c.name === 'diagram') : [top];
  if (pages.length === 0) throw drawioError('SCHEMA_VIOLATION', 'El archivo draw.io no tiene páginas (<diagram>).', HINT);
  const first = pages[0]!;
  return {
    name: first.attrs.get('name') ?? '',
    cells: readModel(await modelOf(first)),
    skipped: pages.slice(1).map((page, i) => page.attrs.get('name') || 'Página ' + (i + 2)),
  };
}
