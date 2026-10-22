/** Tamaño máximo por imagen y por diagrama; los datos quedan embebidos en el JSON del hub. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DIAGRAM_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_DIAGRAM_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_DATA_URL_LENGTH = 64 + 4 * Math.ceil(MAX_IMAGE_BYTES / 3);
const MAX_IMAGE_DIMENSION = 10_000;
const MAX_IMAGE_PIXELS = 40_000_000;

export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/svg+xml';

const IMAGE_DATA_URL = /^data:(image\/png|image\/jpeg|image\/svg\+xml);base64,([A-Za-z0-9+/]*={0,2})$/;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const SAFE_TAGS = new Set(['svg', 'g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'tspan', 'title', 'desc']);
const TEXT_TAGS = new Set(['text', 'tspan', 'title', 'desc']);
const GRAPHIC_TAGS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text']);
const SVG_ATTRIBUTES: Record<string, ReadonlySet<string>> = {
  svg: new Set(['xmlns', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  g: new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  rect: new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  circle: new Set(['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  ellipse: new Set(['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  line: new Set(['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'transform']),
  polyline: new Set(['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  polygon: new Set(['points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  path: new Set(['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'opacity', 'transform']),
  text: new Set(['x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'fill', 'stroke', 'stroke-width', 'opacity', 'transform']),
  tspan: new Set(['x', 'y', 'dx', 'dy', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'fill', 'stroke', 'stroke-width', 'opacity']),
  title: new Set(),
  desc: new Set(),
};

interface SvgNode {
  tag: string;
  attributes: Record<string, string>;
  children: (SvgNode | string)[];
}

function failSvg(): never {
  throw new Error('El SVG contiene XML o contenido activo no permitido.');
}

function validXmlText(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.codePointAt(i)!;
    if (!(code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff))) return false;
    if (code > 0xffff) i++;
  }
  return true;
}

function decodeEntities(value: string): string {
  if (value.replace(/&#(?:x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, '').includes('&')) failSvg();
  const decoded = value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/gi, (_entity, token: string) => {
    if (token === 'amp') return '&';
    if (token === 'lt') return '<';
    if (token === 'gt') return '>';
    if (token === 'quot') return '"';
    if (token === 'apos') return "'";
    const hex = token[1]?.toLowerCase() === 'x';
    const code = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isInteger(code) || code < 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) failSvg();
    return String.fromCodePoint(code);
  });
  if (!validXmlText(decoded)) failSvg();
  return decoded;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function boundedNumbers(value: string): boolean {
  const matches = value.match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  return matches.length > 0 && matches.every((number) => Number.isFinite(Number(number)) && Math.abs(Number(number)) <= 100_000);
}

function parseAttributes(source: string, start: number): { attributes: Record<string, string>; end: number; selfClosing: boolean } {
  const attributes: Record<string, string> = {};
  let i = start;
  while (i < source.length) {
    while (/\s/.test(source[i] ?? '')) i++;
    if (source.startsWith('/>', i)) return { attributes, end: i + 2, selfClosing: true };
    if (source[i] === '>') return { attributes, end: i + 1, selfClosing: false };
    const nameStart = i;
    while (/[A-Za-z0-9_.:-]/.test(source[i] ?? '')) i++;
    if (i === nameStart || !/[A-Za-z_]/.test(source[nameStart] ?? '')) failSvg();
    const name = source.slice(nameStart, i);
    if (Object.hasOwn(attributes, name)) failSvg();
    while (/\s/.test(source[i] ?? '')) i++;
    if (source[i++] !== '=') failSvg();
    while (/\s/.test(source[i] ?? '')) i++;
    const quote = source[i++];
    if (quote !== '"' && quote !== "'") failSvg();
    const valueStart = i;
    while (i < source.length && source[i] !== quote) i++;
    if (i >= source.length) failSvg();
    attributes[name] = decodeEntities(source.slice(valueStart, i));
    i++;
  }
  return failSvg();
}

function readTag(source: string, start: number): { node?: SvgNode; name: string; close: boolean; end: number; selfClosing: boolean } {
  let i = start + 1;
  const close = source[i] === '/';
  if (close) i++;
  const nameStart = i;
  while (/[A-Za-z0-9_.:-]/.test(source[i] ?? '')) i++;
  if (i === nameStart || !/[A-Za-z_]/.test(source[nameStart] ?? '')) failSvg();
  const name = source.slice(nameStart, i);
  if (close) {
    while (/\s/.test(source[i] ?? '')) i++;
    if (source[i] !== '>') failSvg();
    return { name, close, end: i + 1, selfClosing: false };
  }
  const parsed = parseAttributes(source, i);
  return { node: { tag: name, attributes: parsed.attributes, children: [] }, name, close, end: parsed.end, selfClosing: parsed.selfClosing };
}

function safeAttribute(tag: string, name: string, value: string): boolean {
  if (name === 'xmlns') return tag === 'svg' && value === 'http://www.w3.org/2000/svg';
  if (!SVG_ATTRIBUTES[tag]?.has(name) || value.length > 100_000) return false;
  const number = '[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?';
  if (['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'x2', 'y1', 'y2', 'dx', 'dy', 'width', 'height', 'stroke-width', 'font-size'].includes(name)) {
    const match = new RegExp(`^${number}(?:px|pt|pc|mm|cm|in|em|ex|%)?$`, 'i').exec(value);
    return Boolean(match && Number.isFinite(Number.parseFloat(value)) && Math.abs(Number.parseFloat(value)) <= 100_000);
  }
  if (name === 'viewBox') return value.trim().split(/[\s,]+/).length === 4 && value.trim().split(/[\s,]+/).every((n) => /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(n) && Number.isFinite(Number(n)) && Math.abs(Number(n)) <= 100_000);
  if (name === 'preserveAspectRatio') return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: meet| slice)?)$/.test(value);
  if (name === 'fill' || name === 'stroke') return /^(?:none|transparent|currentColor|#[\da-f]{3,8}|[a-z]{1,24})$/i.test(value);
  if (name === 'opacity') return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1;
  if (name === 'stroke-linecap') return /^(?:butt|round|square)$/.test(value);
  if (name === 'stroke-linejoin') return /^(?:miter|round|bevel)$/.test(value);
  if (name === 'fill-rule') return /^(?:nonzero|evenodd)$/.test(value);
  if (name === 'stroke-dasharray' || name === 'points') return /^[-+0-9.eE,\s]+$/.test(value) && boundedNumbers(value);
  if (name === 'd') return value.length <= 100_000 && /^[-+\d.eE,\sMmLlHhVvCcSsQqTtAaZz]+$/.test(value) && boundedNumbers(value);
  if (name === 'transform') return /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\(\s*[-+\d.eE,\s]+\)\s*)+$/.test(value) && boundedNumbers(value);
  if (name === 'font-family') return /^[A-Za-z0-9 _,-]{1,100}$/.test(value);
  if (name === 'font-weight') return /^(?:normal|bold|[1-9]00)$/.test(value);
  if (name === 'text-anchor') return /^(?:start|middle|end)$/.test(value);
  if (name === 'dominant-baseline') return /^(?:auto|middle|central|hanging|text-before-edge|text-after-edge)$/.test(value);
  return false;
}

function sanitizeSvg(source: string): string {
  if (source.length > MAX_IMAGE_BYTES) failSvg();
  const declaration = /^<\?xml\s+version=(["'])1\.0\1(?:\s+encoding=(["'])UTF-8\2)?(?:\s+standalone=(["'])(?:yes|no)\3)?\s*\?>/i;
  if (source.startsWith('<?xml')) {
    const match = declaration.exec(source);
    if (!match) failSvg();
    source = source.slice(match[0].length);
  }
  if (/<!|<\?|-->/i.test(source)) failSvg();
  let i = 0;
  let root: SvgNode | undefined;
  const stack: SvgNode[] = [];
  let count = 0;
  while (i < source.length) {
    if (source[i] !== '<') {
      const end = source.indexOf('<', i);
      const text = decodeEntities(source.slice(i, end < 0 ? source.length : end));
      const parent = stack.at(-1);
      if (text.trim()) {
        if (!parent || !TEXT_TAGS.has(parent.tag)) failSvg();
        parent.children.push(text);
      } else if (parent && TEXT_TAGS.has(parent.tag) && text) parent.children.push(text);
      i = end < 0 ? source.length : end;
      continue;
    }
    const token = readTag(source, i);
    if (token.close) {
      const parent = stack.pop();
      if (!parent || parent.tag !== token.name) failSvg();
      i = token.end;
      continue;
    }
    const node = token.node!;
    if (++count > 50_000 || !SAFE_TAGS.has(node.tag) || stack.length >= 64) failSvg();
    const parent = stack.at(-1);
    if (!parent) {
      if (root || node.tag !== 'svg') failSvg();
      root = node;
    } else {
      if ((parent.tag === 'svg' && !GRAPHIC_TAGS.has(node.tag) && node.tag !== 'title' && node.tag !== 'desc') || (parent.tag === 'g' && !GRAPHIC_TAGS.has(node.tag)) || (TEXT_TAGS.has(parent.tag) && parent.tag !== 'text' && node.tag !== 'tspan') || (parent.tag === 'text' && node.tag !== 'tspan')) failSvg();
      if (!TEXT_TAGS.has(parent.tag) && !['svg', 'g'].includes(parent.tag)) failSvg();
      parent.children.push(node);
    }
    if (node.tag === 'svg' && (Object.hasOwn(node.attributes, 'xmlns') && node.attributes.xmlns !== 'http://www.w3.org/2000/svg')) failSvg();
    for (const [name, value] of Object.entries(node.attributes)) if (!safeAttribute(node.tag, name, value)) failSvg();
    if (token.selfClosing) {
      if (TEXT_TAGS.has(node.tag) && node.tag !== 'title' && node.tag !== 'desc') failSvg();
    } else stack.push(node);
    i = token.end;
  }
  if (stack.length || !root) failSvg();
  return serializeSvg(root);
}

function serializeSvg(node: SvgNode): string {
  const attrs = Object.entries(node.attributes)
    .filter(([name]) => name !== 'xmlns')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join('');
  const namespace = node.tag === 'svg' ? ' xmlns="http://www.w3.org/2000/svg"' : '';
  if (node.children.length === 0 && !TEXT_TAGS.has(node.tag)) return `<${node.tag}${namespace}${attrs}/>`;
  return `<${node.tag}${namespace}${attrs}>${node.children.map((child) => typeof child === 'string' ? escapeXml(child) : serializeSvg(child)).join('')}</${node.tag}>`;
}

function decodeBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error('La imagen debe estar codificada en base64 válido.');
  }
  if (btoa(binary) !== value) throw new Error('La imagen debe usar base64 canónico.');
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeBase64Prefix(value: string, byteLength: number): Uint8Array {
  const encodedLength = Math.ceil(byteLength / 3) * 4;
  const binary = atob(value.slice(0, encodedLength));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function uint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! * 0x1000000) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function pngCrc(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validDimensions(width: number, height: number): boolean {
  return width > 0 && height > 0 && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && width * height <= MAX_IMAGE_PIXELS;
}

function validPng(bytes: Uint8Array): boolean {
  if (bytes.length < 45 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) || uint32(bytes, 8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return false;
  if (!validDimensions(uint32(bytes, 16), uint32(bytes, 20))) return false;
  const bitDepth = bytes[24]!;
  const colorType = bytes[25]!;
  const validBitDepth: Record<number, readonly number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!validBitDepth[colorType]?.includes(bitDepth) || bytes[26] !== 0 || bytes[27] !== 0 || (bytes[28] !== 0 && bytes[28] !== 1)) return false;
  let offset = 8;
  let hasData = false;
  let hasPalette = false;
  let first = true;
  while (offset + 12 <= bytes.length) {
    const length = uint32(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(type) || type[2] !== type[2]!.toUpperCase() || (first && type !== 'IHDR') || length > bytes.length - offset - 12) return false;
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    if (uint32(bytes, crcOffset) !== pngCrc(bytes, offset + 4, crcOffset)) return false;
    if (type === 'IHDR' && (!first || length !== 13)) return false;
    if (type === 'PLTE') {
      if (hasPalette || hasData || length === 0 || length > 768 || length % 3 !== 0 || colorType === 0 || colorType === 4) return false;
      hasPalette = true;
    }
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) return false;
    if (type === 'IDAT' && (length === 0 || colorType === 3 && !hasPalette)) return false;
    if (!['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type) && type[0] === type[0]!.toUpperCase()) return false;
    first = false;
    if (type === 'IDAT') hasData = true;
    offset += length + 12;
    if (type === 'IEND') return length === 0 && hasData && offset === bytes.length;
  }
  return false;
}

function validJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let width = 0;
  let height = 0;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++]!;
    if (marker === 0xda) return validDimensions(width, height) && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
    if (marker === 0xd9) return validDimensions(width, height) && offset === bytes.length;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd8 || offset + 2 > bytes.length) return false;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || length > bytes.length - offset) return false;
    if (frameMarkers.has(marker)) {
      if (length < 8) return false;
      height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      if (!validDimensions(width, height)) return false;
    }
    offset += length;
  }
  return false;
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) return undefined;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++]!;
    if (marker === 0xda || marker === 0xd9) return undefined;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return undefined;
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || length > bytes.length - offset) return undefined;
    if (frameMarkers.has(marker)) {
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      return validDimensions(width, height) ? { width, height } : undefined;
    }
    offset += length;
  }
  return undefined;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Verifica el formato real y devuelve una forma SVG acotada a primitivas pasivas. */
export function sanitizeImageDataUrl(value: string): string {
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) throw new Error(`Cada imagen debe ocupar como máximo ${MAX_IMAGE_BYTES / 1024 / 1024} MiB.`);
  const match = IMAGE_DATA_URL.exec(value);
  if (!match || match[0] !== value) throw new Error('Usa una imagen PNG, JPG o SVG en base64; no se aceptan rutas ni URL externas.');
  const mime = match[1] as ImageMimeType;
  const bytes = decodeBase64(match[2]!);
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(`Cada imagen debe ocupar como máximo ${MAX_IMAGE_BYTES / 1024 / 1024} MiB.`);
  if (mime === 'image/png') {
    if (!validPng(bytes)) throw new Error('El contenido no es un PNG completo y válido o supera sus dimensiones permitidas.');
    return value;
  }
  if (mime === 'image/jpeg') {
    if (!validJpeg(bytes)) throw new Error('El contenido no es un JPG completo y válido o supera sus dimensiones permitidas.');
    return value;
  }
  let svg: string;
  try {
    svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('El SVG debe usar texto UTF-8 válido.');
  }
  const sanitized = new TextEncoder().encode(sanitizeSvg(svg));
  if (sanitized.byteLength === 0 || sanitized.byteLength > MAX_IMAGE_BYTES) throw new Error(`Cada imagen debe ocupar como máximo ${MAX_IMAGE_BYTES / 1024 / 1024} MiB.`);
  return `data:${mime};base64,${encodeBase64(sanitized)}`;
}

/** La frontera del modelo solo acepta datos canónicos ya saneados por `sanitizeImageDataUrl`. */
export function isSanitizedImageDataUrl(value: string): boolean {
  try {
    return sanitizeImageDataUrl(value) === value;
  } catch {
    return false;
  }
}

/** Estima bytes desde el encabezado base64 sin decodificar una entrada no confiable. */
export function imageDataUrlByteLength(value: string): number {
  const comma = value.indexOf(',');
  if (comma < 0) return value.length;
  const payload = value.slice(comma + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/** Calcula el peso total de las imágenes sin volver a decodificar sus datos. */
export function totalImageDataUrlBytes(elements: readonly { kind: string; src?: string }[]): number {
  return elements.reduce((sum, element) => sum + (element.kind === 'image' && element.src ? imageDataUrlByteLength(element.src) : 0), 0);
}

/** Obtiene las dimensiones intrínsecas sin descargar ni rasterizar la imagen. */
export function imageDataUrlDimensions(value: string): { width: number; height: number } | undefined {
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) return undefined;
  const match = IMAGE_DATA_URL.exec(value);
  if (!match) return undefined;
  try {
    if (match[1] === 'image/png') {
      const header = decodeBase64Prefix(match[2]!, 24);
      const width = uint32(header, 16);
      const height = uint32(header, 20);
      return validDimensions(width, height) ? { width, height } : undefined;
    }
    if (match[1] === 'image/jpeg') return jpegDimensions(decodeBase64(match[2]!));
    const source = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(match[2]!));
    const root = /^<svg\b[^>]*\/?\s*>/.exec(source)?.[0];
    if (!root) return undefined;
    const attribute = (name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(root)?.[1];
    const viewBox = attribute('viewBox')?.split(/[\s,]+/).map(Number);
    if (viewBox?.length === 4 && Number.isFinite(viewBox[2]) && Number.isFinite(viewBox[3]) && viewBox[2]! > 0 && viewBox[3]! > 0) {
      return { width: viewBox[2]!, height: viewBox[3]! };
    }
    const width = Number.parseFloat(attribute('width') ?? '');
    const height = Number.parseFloat(attribute('height') ?? '');
    return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? { width, height } : { width: 300, height: 150 };
  } catch {
    return undefined;
  }
}

/** Cuenta los píxeles raster declarados en PNG/JPG; los SVG no reservan una superficie raster aquí. */
export function totalImageRasterPixels(elements: readonly { kind: string; src?: string }[]): number {
  return elements.reduce((sum, element) => {
    if (element.kind !== 'image' || !element.src) return sum;
    if (element.src.startsWith('data:image/svg+xml;')) return sum;
    const dimensions = imageDataUrlDimensions(element.src);
    return sum + (dimensions ? dimensions.width * dimensions.height : MAX_DIAGRAM_IMAGE_PIXELS + 1);
  }, 0);
}

/** Forma URL percent-encoded para draw.io, cuyo estilo usa `;` como separador. */
export function imageDataUrlForDrawio(value: string): string {
  if (!isSanitizedImageDataUrl(value)) throw new Error('La imagen no pasó la validación del core.');
  const match = IMAGE_DATA_URL.exec(value)!;
  const bytes = decodeBase64(match[2]!);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    let chunk = '';
    for (const byte of bytes.subarray(i, i + 8192)) chunk += `%${byte.toString(16).padStart(2, '0')}`;
    chunks.push(chunk);
  }
  return `data:${match[1]},${chunks.join('')}`;
}
