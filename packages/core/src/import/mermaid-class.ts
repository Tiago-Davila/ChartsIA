import { DiagramInputSchema, type DiagramInput } from '../model/diagram.js';
import { DEFAULT_MAX_ELEMENTS } from '../model/enums.js';
import { validateDiagram } from '../validation/index.js';

export const MAX_MERMAID_SOURCE_LENGTH = 256 * 1024;
export const MAX_MERMAID_LINES = 10_000;
export const MAX_MERMAID_LINE_LENGTH = 8_192;
export const MAX_MERMAID_RELATIONS = 1_000;
export const MAX_MERMAID_NAMESPACE_DEPTH = 32;
export const MAX_MERMAID_TYPE_DEPTH = 32;
export const MAX_MERMAID_ANNOTATIONS = 8;

export class MermaidImportError extends Error {
  constructor(message: string, readonly line?: number) {
    super(message);
    this.name = 'MermaidImportError';
  }
}

export interface MermaidImportResult {
  diagram: DiagramInput;
  warnings: string[];
}

interface ClassName { symbol: string; display?: string; generic?: string }
interface MutableClass {
  key: string;
  symbol: string;
  namespace: string[];
  id: string;
  name: string;
  kind: 'class' | 'interface' | 'enum';
  abstract?: boolean;
  stereotype?: string;
  annotations: string[];
  attributes: { name: string; type?: string; visibility: '+' | '-' | '#' | '~'; static?: boolean; defaultValue?: string }[];
  operations: { name: string; parameters: { name: string; type?: string }[]; returnType?: string; visibility: '+' | '-' | '#' | '~'; static?: boolean; abstract?: boolean }[];
  literals: string[];
  explicit: boolean;
}
interface NamespaceInfo { id: string; name: string; parentId?: string }
interface RawRelation {
  left: ClassName;
  right: ClassName;
  namespace: string[];
  line: number;
  op: string;
  leftMultiplicity?: string;
  rightMultiplicity?: string;
  label?: string;
}

const SIMPLE_MULTIPLICITY = /^(\d+|\*)(\.\.(\d+|\*))?$/;
const ID_PART = /[\p{L}\p{N}_-]/u;
const BACKTICK = String.fromCharCode(96);
const RELATION_MARKS = ['', '<|', '|>', '*', 'o', '()', '<', '>'];
const RELATION_OPERATORS = RELATION_MARKS.flatMap((left) => ['--', '..'].flatMap((line) => RELATION_MARKS.map((right) => left + line + right)))
  .sort((a, b) => b.length - a.length);

function addAnnotation(target: MutableClass, annotation: string, line: number): void {
  if (!annotation || annotation.length > 60) fail('La anotación debe tener entre 1 y 60 caracteres.', line);
  if (target.annotations.includes(annotation)) return;
  if (target.annotations.length >= MAX_MERMAID_ANNOTATIONS) fail('Una clase supera el límite de ' + MAX_MERMAID_ANNOTATIONS + ' anotaciones.', line);
  target.annotations.push(annotation);
}

function fail(message: string, line?: number): never {
  throw new MermaidImportError(message, line);
}
function isIdPart(char: string | undefined): boolean {
  return char !== undefined && ID_PART.test(char);
}
function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let parentheses = 0;
  let angles = 0;
  let tildes = 0;
  let quote = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === BACKTICK) quote = char;
    else if (char === '(') parentheses++;
    else if (char === ')') parentheses = Math.max(0, parentheses - 1);
    else if (separator !== ':' && char === '<') angles++;
    else if (separator !== ':' && char === '>') angles = Math.max(0, angles - 1);
    else if (char === '~') tildes++;
    else if (char === separator && parentheses === 0 && angles === 0 && tildes % 2 === 0) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}
function classNameAt(value: string, start = 0, line?: number): { value: ClassName; end: number } | undefined {
  let i = start;
  while (/\s/.test(value[i] ?? '')) i++;
  let symbol: string;
  let display: string | undefined;
  if (value[i] === BACKTICK) {
    const end = value.indexOf(BACKTICK, i + 1);
    if (end < 0) return undefined;
    symbol = value.slice(i + 1, end);
    display = symbol;
    i = end + 1;
  } else {
    const begin = i;
    while (isIdPart(value[i]) || value[i] === '.') i++;
    if (i === begin) return undefined;
    symbol = value.slice(begin, i);
  }
  let generic: string | undefined;
  if (value[i] === '~') {
    const begin = i + 1;
    const closing = skipGenericType(value, begin, 0, line);
    if (closing < 0 || value[closing] !== '~') return undefined;
    generic = value.slice(begin, closing);
    i = closing + 1;
  }
  if (!symbol || symbol.split('.').some((part) => !part)) return undefined;
  return { value: { symbol, ...(display ? { display } : {}), ...(generic ? { generic } : {}) }, end: i };
}
function skipGenericType(value: string, start: number, depth: number, line?: number): number {
  if (depth > MAX_MERMAID_TYPE_DEPTH) fail('El tipo genérico supera la profundidad máxima de ' + MAX_MERMAID_TYPE_DEPTH + '.', line);
  let cursor = start;
  while (cursor < value.length && value[cursor] !== '~' && value[cursor] !== ',') cursor++;
  const base = value.slice(start, cursor).trim();
  if (!base) return -1;
  if (value[cursor] !== '~') return cursor;
  let lookahead = cursor + 1;
  while (/\s/.test(value[lookahead] ?? '')) lookahead++;
  if (lookahead >= value.length || value[lookahead] === '~' || value[lookahead] === ',') return cursor;
  const nestedEnd = skipGenericType(value, cursor + 1, depth + 1, line);
  if (nestedEnd < 0 || value[nestedEnd] !== '~') return -1;
  return nestedEnd + 1;
}
function readQuoted(value: string, start: number): { value: string; end: number } | undefined {
  if (value[start] !== '"') return undefined;
  const end = value.indexOf('"', start + 1);
  if (end < 0) return undefined;
  return { value: value.slice(start + 1, end), end: end + 1 };
}
function parseType(value: string, line?: number): string {
  const source = value.trim();
  if (!source.includes('~')) return source;
  let cursor = 0;
  const read = (stopAtTilde: boolean, depth: number): string => {
    if (depth > MAX_MERMAID_TYPE_DEPTH) fail('El tipo genérico supera la profundidad máxima de ' + MAX_MERMAID_TYPE_DEPTH + '.', line);
    const start = cursor;
    while (cursor < source.length && source[cursor] !== '~' && source[cursor] !== ',') cursor++;
    const base = source.slice(start, cursor).trim();
    if (source[cursor] !== '~') return base;
    let lookahead = cursor + 1;
    while (/\s/.test(source[lookahead] ?? '')) lookahead++;
    if (stopAtTilde && (lookahead >= source.length || source[lookahead] === '~' || source[lookahead] === ',')) return base;
    cursor++;
    const inner = read(true, depth + 1);
    if (source[cursor] !== '~') return base + '~' + inner;
    cursor++;
    return base + '<' + inner + '>';
  };
  const result = read(false, 0);
  if (cursor !== source.length) fail('El tipo genérico no está balanceado.', line);
  return result || source;
}
function memberNameType(value: string, line: number): { name: string; type?: string; defaultValue?: string } {
  const colon = splitTopLevel(value.trim(), ':');
  if (colon.length > 1) {
    const defaults = splitTopLevel(colon.slice(1).join(':').trim(), '=');
    return { name: colon[0]!.trim(), ...(defaults[0] ? { type: parseType(defaults[0]!, line) } : {}), ...(defaults.length > 1 ? { defaultValue: defaults.slice(1).join('=').trim() } : {}) };
  }
  const defaults = splitTopLevel(value.trim(), '=');
  const words = defaults[0]!.trim().split(/\s+/);
  return { name: words.at(-1) ?? '', ...(words.length > 1 ? { type: parseType(words.slice(0, -1).join(' '), line) } : {}), ...(defaults.length > 1 ? { defaultValue: defaults.slice(1).join('=').trim() } : {}) };
}
function parseMember(text: string, line: number, target: MutableClass): void {
  text = text.trim().replace(/;$/, '').trim();
  if (!text) return;
  if (text.startsWith('<<') && text.endsWith('>>')) {
    const annotation = text.slice(2, -2).trim();
    addAnnotation(target, annotation, line);
    return;
  }
  let visibility: '+' | '-' | '#' | '~' = '+';
  if (['+', '-', '#', '~'].includes(text[0]!)) {
    visibility = text[0] as typeof visibility;
    text = text.slice(1).trimStart();
  }
  const open = text.indexOf('(');
  if (open >= 0) {
    let depth = 1;
    let close = open + 1;
    while (close < text.length && depth > 0) {
      if (text[close] === '(') depth++;
      else if (text[close] === ')') depth--;
      close++;
    }
    if (depth !== 0) fail('Paréntesis sin cerrar en un método.', line);
    const name = text.slice(0, open).trim();
    if (!name) fail('El método necesita un nombre antes de ().', line);
    const args = text.slice(open + 1, close - 1).trim();
    let suffix = text.slice(close).trim();
    let isStatic = false;
    let isAbstract = false;
    while (suffix.endsWith('$') || suffix.endsWith('*')) {
      if (suffix.endsWith('$')) isStatic = true;
      else isAbstract = true;
      suffix = suffix.slice(0, -1).trimEnd();
    }
    if (target.operations.length >= 200) fail('Una clase supera el límite de 200 métodos.', line);
    const parameters = args ? splitTopLevel(args, ',').map((part, index) => {
      const parsed = memberNameType(part.trim(), line);
      if (!parsed.name) fail('El parámetro ' + (index + 1) + ' no tiene nombre.', line);
      return { name: parsed.name, ...(parsed.type ? { type: parsed.type } : {}) };
    }) : [];
    if (parameters.length > 50) fail('Un método supera el límite de 50 parámetros.', line);
    const returnType = suffix.startsWith(':') ? suffix.slice(1).trim() : suffix;
    target.operations.push({ name, parameters, ...(returnType ? { returnType: parseType(returnType, line) } : {}), visibility, ...(isStatic ? { static: true } : {}), ...(isAbstract ? { abstract: true } : {}) });
    return;
  }
  let isStatic = false;
  if (text.endsWith('$')) {
    isStatic = true;
    text = text.slice(0, -1).trimEnd();
  }
  const field = memberNameType(text, line);
  if (!field.name) fail('El atributo necesita un nombre.', line);
  if (target.annotations.some((annotation) => ['enumeration', 'enum'].includes(annotation.toLowerCase())) && !text.includes(':') && !field.type && !isStatic) {
    if (target.literals.length >= 200) fail('Un enum supera el límite de 200 literales.', line);
    if (!target.literals.includes(field.name)) target.literals.push(field.name);
    return;
  }
  if (target.attributes.length >= 200) fail('Una clase supera el límite de 200 atributos.', line);
  target.attributes.push({ name: field.name, ...(field.type ? { type: field.type } : {}), visibility, ...(isStatic ? { static: true } : {}), ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}) });
}
function relationParts(value: string, line?: number): Omit<RawRelation, 'line' | 'namespace'> | undefined {
  const colon = splitTopLevel(value, ':');
  const statement = colon[0]!.trim();
  const label = colon.length > 1 ? colon.slice(1).join(':').trim() : undefined;
  const left = classNameAt(statement, 0, line);
  if (!left) return undefined;
  let cursor = left.end;
  while (/\s/.test(statement[cursor] ?? '')) cursor++;
  let leftMultiplicity: string | undefined;
  const before = readQuoted(statement, cursor);
  if (before) {
    leftMultiplicity = before.value;
    cursor = before.end;
    while (/\s/.test(statement[cursor] ?? '')) cursor++;
  }
  const op = RELATION_OPERATORS.find((candidate) => statement.startsWith(candidate, cursor));
  if (!op) return undefined;
  cursor += op.length;
  while (/\s/.test(statement[cursor] ?? '')) cursor++;
  let rightMultiplicity: string | undefined;
  const after = readQuoted(statement, cursor);
  if (after) {
    rightMultiplicity = after.value;
    cursor = after.end;
    while (/\s/.test(statement[cursor] ?? '')) cursor++;
  }
  const right = classNameAt(statement, cursor, line);
  if (!right) return undefined;
  let end = right.end;
  while (/\s/.test(statement[end] ?? '')) end++;
  if (end !== statement.length) return undefined;
  return { left: left.value, right: right.value, op, ...(leftMultiplicity !== undefined ? { leftMultiplicity } : {}), ...(rightMultiplicity !== undefined ? { rightMultiplicity } : {}), ...(label ? { label } : {}) };
}
function firstUnquoted(value: string, char: string): number {
  let quote = '';
  for (let i = 0; i < value.length; i++) {
    if (quote) {
      if (value[i] === quote) quote = '';
    } else if (value[i] === '"' || value[i] === BACKTICK) quote = value[i]!;
    else if (value[i] === char) return i;
  }
  return -1;
}
function parseNamespace(value: string): { parts: string[]; label?: string } | undefined {
  const text = value.trim();
  const bracket = text.indexOf('[');
  const raw = bracket < 0 ? text : text.slice(0, bracket).trim();
  const quoted = bracket >= 0 ? readQuoted(text, bracket + 1) : undefined;
  const label = quoted && quoted.end === text.length - 1 && text.endsWith(']') ? quoted.value : undefined;
  if (bracket >= 0 && label === undefined) return undefined;
  const parts = raw.split('.');
  if (parts.some((part) => !part || [...part].some((char) => !isIdPart(char)))) return undefined;
  return { parts, ...(label ? { label } : {}) };
}
function convertMultiplicity(value: string | undefined): { value?: string; note?: string } {
  if (value === undefined || value === '') return {};
  return SIMPLE_MULTIPLICITY.test(value) ? { value } : { note: value };
}
function combinedLabel(label: string | undefined, extras: string[]): string | undefined {
  const parts = [label?.trim(), ...extras].filter((part): part is string => Boolean(part));
  if (!parts.length) return undefined;
  const joined = parts.join(' · ');
  if (joined.length > 200) fail('La etiqueta combinada de una relación supera el máximo de 200 caracteres.');
  return joined;
}
function stripComment(line: string): string {
  const text = line.trim();
  return text.startsWith('%%') ? '' : text;
}

/** Convierte classDiagram al modelo canónico; nunca interpreta HTML, JavaScript ni enlaces. */
export function importMermaidClassDiagram(source: string, title?: string): MermaidImportResult {
  if (typeof source !== 'string') fail('La entrada Mermaid debe ser texto.');
  if (source.length > MAX_MERMAID_SOURCE_LENGTH) fail('El texto supera el máximo de ' + (MAX_MERMAID_SOURCE_LENGTH / 1024) + ' Ki caracteres.');
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > MAX_MERMAID_LINES) fail('El texto supera el máximo de ' + MAX_MERMAID_LINES + ' líneas.');
  lines.forEach((line, index) => {
    if (line.length > MAX_MERMAID_LINE_LENGTH) fail('La línea supera el máximo de ' + MAX_MERMAID_LINE_LENGTH + ' caracteres.', index + 1);
  });
  const warnings: string[] = [];
  const warn = (message: string) => { if (warnings.length < 50 && !warnings.includes(message)) warnings.push(message); };
  let titleFromFrontmatter: string | undefined;
  let inFrontmatter = false;
  let frontmatterStarted = false;
  let foundHeader = false;
  const namespaces = new Map<string, NamespaceInfo>();
  const classes = new Map<string, MutableClass>();
  const rawRelations: RawRelation[] = [];
  const namespacePath: string[] = [];
  const namespaceFrames: number[] = [];
  let currentClass: MutableClass | undefined;
  let currentClassBlock = false;
  let classCounter = 0;
  let packageCounter = 0;
  const makeClassKey = (ns: string[], symbol: string) => ns.join('.') + '/' + symbol;

  const ensureNamespace = (parts: string[], label?: string, line?: number): string | undefined => {
    if (parts.length > MAX_MERMAID_NAMESPACE_DEPTH) fail('Un namespace supera la profundidad máxima de ' + MAX_MERMAID_NAMESPACE_DEPTH + '.', line);
    let parentId: string | undefined;
    const path: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      path.push(parts[i]!);
      const key = path.join('.');
      let info = namespaces.get(key);
      if (!info) {
        if (classes.size + namespaces.size >= DEFAULT_MAX_ELEMENTS) fail('El diagrama supera el máximo de ' + DEFAULT_MAX_ELEMENTS + ' elementos.', line);
        info = { id: 'P' + (++packageCounter), name: i === parts.length - 1 && label ? label : parts[i]!, ...(parentId ? { parentId } : {}) };
        namespaces.set(key, info);
      } else if (i === parts.length - 1 && label) info.name = label;
      parentId = info.id;
    }
    return parentId;
  };
  const ensureClass = (name: ClassName, currentNamespace: string[], line: number, explicit = false): MutableClass => {
    let symbol = name.symbol;
    let ns = [...currentNamespace];
    if (symbol.includes('.')) {
      const parts = symbol.split('.');
      symbol = parts.pop()!;
      ns = [...currentNamespace, ...parts];
    }
    const key = makeClassKey(ns, symbol);
    let item = classes.get(key);
    if (!item) {
      if (classes.size + namespaces.size >= DEFAULT_MAX_ELEMENTS) fail('El diagrama supera el máximo de ' + DEFAULT_MAX_ELEMENTS + ' elementos.', line);
      const parentId = ensureNamespace(ns, undefined, line);
      item = { key, symbol, namespace: ns, id: 'C' + (++classCounter), name: name.display ?? (name.generic ? symbol + '<' + parseType(name.generic) + '>' : symbol), kind: 'class', annotations: [], attributes: [], operations: [], literals: [], explicit };
      if (parentId) (item as MutableClass & { parentId?: string }).parentId = parentId;
      classes.set(key, item);
    } else {
      if (explicit) item.explicit = true;
      if (name.display) item.name = name.display;
      else if (name.generic) item.name = symbol + '<' + parseType(name.generic) + '>';
    }
    return item;
  };
  const parseClassHeader = (text: string, line: number): { item: MutableClass; hasBody: boolean } => {
    const bodyIndex = firstUnquoted(text, '{');
    const header = (bodyIndex >= 0 ? text.slice(0, bodyIndex) : text).trim();
    const parsed = classNameAt(header, 'class '.length, line);
    if (!parsed) fail('No se reconoce el nombre de la clase. Usa class Nombre o una etiqueta entre corchetes.', line);
    let cursor = parsed.end;
    while (/\s/.test(header[cursor] ?? '')) cursor++;
    let display = parsed.value.display;
    if (header[cursor] === '[') {
      const label = readQuoted(header, cursor + 1);
      if (!label || header[label.end] !== ']') fail('La etiqueta de clase requiere class Id["Etiqueta"].', line);
      display = label.value;
      cursor = label.end + 1;
    }
    const rest = header.slice(cursor).trim();
    let annotation: string | undefined;
    if (rest.startsWith('<<') && rest.endsWith('>>')) annotation = rest.slice(2, -2).trim();
    else if (rest && !rest.startsWith(':::')) fail('Hay texto no reconocido después del nombre de clase.', line);
    if (rest.startsWith(':::')) warn('Se ignoraron estilos Mermaid de clase (línea ' + line + '); el contenido no se ejecutó.');
    const item = ensureClass({ ...parsed.value, ...(display ? { display } : {}) }, namespacePath, line, true);
    if (annotation) addAnnotation(item, annotation, line);
    if (bodyIndex < 0) return { item, hasBody: false };
    const closeIndex = text.indexOf('}', bodyIndex + 1);
    if (closeIndex < 0) return { item, hasBody: true };
    const inline = text.slice(bodyIndex + 1, closeIndex).trim();
    if (inline) parseMember(inline, line, item);
    if (text.slice(closeIndex + 1).trim()) fail('No se admite texto después del cierre del bloque de clase.', line);
    return { item, hasBody: false };
  };
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const originalLine = lines[i]!.trim();
    if (originalLine.startsWith('%%{')) {
      warn('Se ignoró la directiva de configuración Mermaid (línea ' + lineNo + '); no se ejecutó su contenido.');
      continue;
    }
    const line = stripComment(originalLine);
    if (!line) continue;
    if (!foundHeader && line === '---') {
      if (!frontmatterStarted) { frontmatterStarted = true; inFrontmatter = true; }
      else if (inFrontmatter) {
        inFrontmatter = false;
        warn('Se ignoró la configuración/front matter de Mermaid; solo se importó el contenido del diagrama.');
      }
      continue;
    }
    if (inFrontmatter) {
      const titleMatch = /^title\s*:\s*(.*)$/.exec(line);
      if (titleMatch) titleFromFrontmatter = titleMatch[1]!.trim().replace(/^['"]|['"]$/g, '');
      continue;
    }
    if (!foundHeader) {
      if (line === 'classDiagram' || line === 'classDiagram-v2') { foundHeader = true; continue; }
      fail('El texto debe comenzar con classDiagram o classDiagram-v2 (puede incluir front matter ---).', lineNo);
    }
    if (currentClassBlock) {
      if (line === '}') { currentClassBlock = false; currentClass = undefined; continue; }
      if (line.includes('{') || line.includes('}')) fail('No se admiten bloques anidados dentro de una clase.', lineNo);
      if (currentClass) parseMember(line, lineNo, currentClass);
      continue;
    }
    if (line === '}') {
      const frame = namespaceFrames.pop();
      if (frame === undefined) fail('Hay un cierre } sin namespace abierto.', lineNo);
      namespacePath.length = frame;
      continue;
    }
    if (line.startsWith('namespace ')) {
      const raw = line.slice('namespace '.length);
      if (!raw.endsWith('{')) fail('Un namespace debe abrirse con { .', lineNo);
      const parsed = parseNamespace(raw.slice(0, -1));
      if (!parsed) fail('Nombre de namespace inválido; usa segmentos alfanuméricos separados por puntos y etiqueta opcional.', lineNo);
      const baseLength = namespacePath.length;
      const fullPath = [...namespacePath, ...parsed.parts];
      ensureNamespace(fullPath, parsed.label, lineNo);
      namespaceFrames.push(baseLength);
      namespacePath.splice(0, namespacePath.length, ...fullPath);
      continue;
    }
    if (line.startsWith('class ')) {
      const parsed = parseClassHeader(line, lineNo);
      if (parsed.hasBody) { currentClass = parsed.item; currentClassBlock = true; }
      continue;
    }
    if (line.startsWith('<<') && line.includes('>>')) {
      const close = line.indexOf('>>');
      const annotation = line.slice(2, close).trim();
      const target = classNameAt(line, close + 2, lineNo);
      if (!target || line.slice(target.end).trim()) fail('La anotación necesita una clase: <<interface>> Nombre.', lineNo);
      addAnnotation(ensureClass(target.value, namespacePath, lineNo), annotation, lineNo);
      continue;
    }
    const relation = relationParts(line, lineNo);
    if (relation) {
      if (rawRelations.length >= MAX_MERMAID_RELATIONS) fail('El diagrama supera el límite de ' + MAX_MERMAID_RELATIONS + ' relaciones.', lineNo);
      rawRelations.push({ ...relation, namespace: [...namespacePath], line: lineNo });
      continue;
    }
    const memberColon = firstUnquoted(line, ':');
    if (memberColon >= 0) {
      const owner = classNameAt(line, 0, lineNo);
      const tail = owner ? line.slice(owner.end).trimStart() : '';
      if (owner && tail.startsWith(':')) {
        parseMember(tail.slice(1), lineNo, ensureClass(owner.value, namespacePath, lineNo));
        continue;
      }
    }
    if (/^(direction\s+|style\s+|classDef\s+|cssClass\s+|accTitle\s*:|accDescr\s*:|note(?:\s|$)|action\s+|click\s+|link\s+|callback\s+)/.test(line)) {
      const interactive = /^(action|click|link|callback)\s+/.test(line);
      warn('Se ignoró una directiva Mermaid' + (interactive ? ' interactiva (no se ejecutaron callbacks ni se abrieron URL)' : ' visual') + ' (línea ' + lineNo + ').');
      continue;
    }
    if (line.includes(':::')) {
      warn('Se ignoró el estilo Mermaid de la línea ' + lineNo + '; el contenido no se ejecutó.');
      continue;
    }
    fail('No se reconoce esta instrucción Mermaid. Revisa la sintaxis classDiagram; se rechazó para no perder datos.', lineNo);
  }
  if (!foundHeader) fail('No se encontró la línea classDiagram.');
  if (currentClassBlock) fail('El bloque de clase quedó abierto sin }.', lines.length);
  if (namespaceFrames.length > 0) fail('Un namespace quedó abierto sin }.', lines.length);

  const resolveClass = (name: ClassName, ns: string[], line: number): MutableClass => {
    let symbol = name.symbol;
    if (symbol.includes('.')) {
      const parts = symbol.split('.');
      symbol = parts.pop()!;
      const found = classes.get(makeClassKey(parts, symbol)) ?? classes.get(makeClassKey([...ns, ...parts], symbol));
      if (found) return found;
      return ensureClass({ ...name, symbol }, parts, line);
    }
    const local = classes.get(makeClassKey(ns, symbol));
    if (local) return local;
    const matches = [...classes.values()].filter((item) => item.symbol === symbol);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) fail('La referencia "' + symbol + '" coincide con varias clases de namespaces distintos. Usa un nombre calificado.', line);
    return ensureClass(name, ns, line);
  };

  // Las anotaciones afectan las reglas de los extremos; clasificar antes de crear relaciones.
  for (const item of classes.values()) {
    const annotations = item.annotations.map((annotation) => annotation.toLowerCase());
    const represented = new Set<string>();
    if (annotations.includes('interface')) {
      item.kind = 'interface';
      represented.add('interface');
    } else if (annotations.includes('enumeration') || annotations.includes('enum')) {
      represented.add('enumeration');
      represented.add('enum');
      if (item.literals.length) item.kind = 'enum';
      else {
        item.kind = 'class';
        item.stereotype = 'enumeration';
        warn('La clase "' + item.name + '" tiene anotación de enum pero no contiene literales; se conservó como clase estereotipada.');
      }
    } else if (annotations.includes('abstract')) {
      item.kind = 'class';
      item.abstract = true;
      represented.add('abstract');
      const stereotype = item.annotations.find((annotation) => annotation.toLowerCase() !== 'abstract');
      if (stereotype) {
        item.stereotype = stereotype;
        represented.add(stereotype.toLowerCase());
      }
    } else if (item.annotations.length) {
      item.stereotype = item.annotations[0]!;
      represented.add(annotations[0]!);
    }
    const omitted = item.annotations.filter((annotation) => !represented.has(annotation.toLowerCase()));
    if (omitted.length) warn('La clase "' + item.name + '" tiene anotaciones que no admite el modelo canónico y se omitieron: ' + omitted.join(', ') + '.');
  }

  const relations: DiagramInput['relations'] = [];
  let relationCounter = 0;
  for (const raw of rawRelations) {
    const left = resolveClass(raw.left, raw.namespace, raw.line);
    const right = resolveClass(raw.right, raw.namespace, raw.line);
    const leftMult = convertMultiplicity(raw.leftMultiplicity);
    const rightMult = convertMultiplicity(raw.rightMultiplicity);
    const unsupported = [
      leftMult.note ? 'multiplicidad izquierda "' + leftMult.note + '"' : undefined,
      rightMult.note ? 'multiplicidad derecha "' + rightMult.note + '"' : undefined,
    ].filter((part): part is string => part !== undefined);
    const allMultiplicity = [
      raw.leftMultiplicity ? 'multiplicidad izquierda "' + raw.leftMultiplicity + '"' : undefined,
      raw.rightMultiplicity ? 'multiplicidad derecha "' + raw.rightMultiplicity + '"' : undefined,
    ].filter((part): part is string => part !== undefined);
    const warnMultiplicity = (reason: string) => {
      if (allMultiplicity.length) warn('La multiplicidad de la línea ' + raw.line + ' (' + allMultiplicity.join(' y ') + ') se conservó en la etiqueta porque ' + reason + '.');
    };
    const op = raw.op;
    const separatorIndex = op.indexOf('--') >= 0 ? op.indexOf('--') : op.indexOf('..');
    const leftMark = op.slice(0, separatorIndex);
    const lineMark = op.slice(separatorIndex, separatorIndex + 2);
    const rightMark = op.slice(separatorIndex + 2);
    const dotted = lineMark === '..';
    const doubleEnded = Boolean(leftMark && rightMark);
    if (doubleEnded) {
      const visible = op.replace('--', '—').replace('..', '··');
      const label = combinedLabel(raw.label, [...allMultiplicity.map((text) => 'Mermaid: ' + text), 'Mermaid: ' + visible]);
      relations.push({ id: 'R' + (++relationCounter), kind: 'connector', source: left.id, target: right.id, arrowheads: 'both', ...(dotted ? { dashed: true } : {}), ...(label ? { label } : {}) });
      warn('La relación de dos extremos de la línea ' + raw.line + ' se importó como conector bidireccional; los adornos UML específicos quedan en su etiqueta.');
      warnMultiplicity('el conector bidireccional no admite campos de multiplicidad');
      continue;
    }
    let source = left;
    let target = right;
    let kind: DiagramInput['relations'][number]['kind'] = 'association';
    let navigable: 'source-to-target' | undefined;
    let arrowheads: 'none' | 'end' | 'both' | undefined;
    let dashed = false;
    let sourceMultiplicity = leftMult.value;
    let targetMultiplicity = rightMult.value;
    let lollipop = false;
    if (leftMark === '()' || rightMark === '()') {
      lollipop = true;
      const iface = leftMark === '()' ? left : right;
      const impl = leftMark === '()' ? right : left;
      if (iface.explicit && iface.kind === 'class' && !iface.annotations.some((annotation) => annotation.toLowerCase() === 'interface')) {
        const label = combinedLabel(raw.label, allMultiplicity.map((text) => 'Mermaid: ' + text));
        relations.push({ id: 'R' + (++relationCounter), kind: 'connector', source: impl.id, target: iface.id, arrowheads: 'end', ...(label ? { label } : {}) });
        warn('El lollipop de la línea ' + raw.line + ' apunta a una clase declarada; se conservó como conector.');
        warnMultiplicity('el conector no admite campos de multiplicidad');
        continue;
      }
      iface.kind = 'interface';
      source = impl;
      target = iface;
      kind = 'realization';
    } else if (leftMark === '*' || rightMark === '*') {
      kind = 'composition';
      if (rightMark === '*') { source = right; target = left; sourceMultiplicity = rightMult.value; targetMultiplicity = leftMult.value; }
    } else if (leftMark === 'o' || rightMark === 'o') {
      kind = 'aggregation';
      if (rightMark === 'o') { source = right; target = left; sourceMultiplicity = rightMult.value; targetMultiplicity = leftMult.value; }
    } else if (leftMark === '<|' || rightMark === '|>') {
      const leftMarker = leftMark === '<|';
      kind = dotted ? 'realization' : 'inheritance';
      if (leftMarker) { source = right; target = left; sourceMultiplicity = rightMult.value; targetMultiplicity = leftMult.value; }
      if (dotted) target.kind = 'interface';
    } else if (leftMark === '<' || rightMark === '>') {
      const leftArrow = leftMark === '<';
      source = leftArrow ? right : left;
      target = leftArrow ? left : right;
      if (leftArrow) { sourceMultiplicity = rightMult.value; targetMultiplicity = leftMult.value; }
      navigable = 'source-to-target';
      if (dotted) { kind = 'dependency'; navigable = undefined; }
    } else if (dotted) {
      kind = 'connector';
      dashed = true;
      arrowheads = 'none';
    }
    if (lollipop) warn('El lollipop de la línea ' + raw.line + ' se importó como realización; el render canónico usa triángulo abierto en vez del círculo.');
    if (kind === 'realization' && source.kind !== 'class') {
      warn('La relación discontinua de la línea ' + raw.line + ' no parte de una clase; se conservó como conector.');
      const label = combinedLabel(raw.label, allMultiplicity.map((text) => 'Mermaid: ' + text));
      relations.push({ id: 'R' + (++relationCounter), kind: 'connector', source: source.id, target: target.id, arrowheads: 'end', dashed: true, ...(label ? { label } : {}) });
      warnMultiplicity('el conector no admite campos de multiplicidad');
      continue;
    }
    if (kind === 'realization' && target.kind !== 'interface') target.kind = 'interface';
    if (kind === 'inheritance' && source.kind !== target.kind) {
      if (source.kind === 'class' && target.kind === 'interface') {
        kind = 'realization';
        warn('La relación sólida de la línea ' + raw.line + ' une clase e interfaz; se importó como realización discontinua.');
      } else {
        const label = combinedLabel(raw.label, allMultiplicity.map((text) => 'Mermaid: ' + text));
        relations.push({ id: 'R' + (++relationCounter), kind: 'connector', source: source.id, target: target.id, arrowheads: 'end', ...(label ? { label } : {}) });
        warn('La relación de la línea ' + raw.line + ' no encaja en las reglas de herencia UML; se conservó como conector.');
        warnMultiplicity('el conector no admite campos de multiplicidad');
        continue;
      }
    }
    const acceptsMultiplicity = ['association', 'aggregation', 'composition'].includes(kind);
    const labelNotes = acceptsMultiplicity ? unsupported : allMultiplicity;
    const label = combinedLabel(raw.label, labelNotes.map((text) => 'Mermaid: ' + text));
    relations.push({
      id: 'R' + (++relationCounter),
      kind,
      source: source.id,
      target: target.id,
      ...(label ? { label } : {}),
      ...(sourceMultiplicity && ['association', 'aggregation', 'composition'].includes(kind) ? { sourceMultiplicity } : {}),
      ...(targetMultiplicity && ['association', 'aggregation', 'composition'].includes(kind) ? { targetMultiplicity } : {}),
      ...(navigable && kind === 'association' ? { navigable } : {}),
      ...(kind === 'connector' ? { arrowheads: arrowheads ?? 'end', ...(dashed ? { dashed: true } : {}) } : {}),
    });
    if (dotted && ['aggregation', 'composition'].includes(kind)) warn('La línea discontinua de la relación en línea ' + raw.line + ' no se representa en el modelo canónico.');
    if (acceptsMultiplicity && unsupported.length) warn('La ' + unsupported.join(' y ') + ' de la línea ' + raw.line + ' se conservó en la etiqueta; el modelo admite cardinalidades numéricas o *.');
    if (!acceptsMultiplicity) warnMultiplicity('el tipo de relación ' + kind + ' no admite campos de multiplicidad');
  }

  const elements: DiagramInput['elements'] = [
    ...[...namespaces.values()].map((item) => ({ id: item.id, name: item.name, kind: 'package' as const, ...(item.parentId ? { parentId: item.parentId } : {}) })),
    ...[...classes.values()].map((item) => {
      const parentId = namespaces.get(item.namespace.join('.'))?.id;
      const base = { id: item.id, name: item.name, ...(parentId ? { parentId } : {}) };
      if (item.kind === 'interface') return { ...base, kind: 'interface' as const, ...(item.attributes.length ? { attributes: item.attributes } : {}), operations: item.operations };
      if (item.kind === 'enum' && item.literals.length) return { ...base, kind: 'enum' as const, literals: item.literals, ...(item.attributes.length ? { attributes: item.attributes } : {}), ...(item.operations.length ? { operations: item.operations } : {}) };
      return { ...base, kind: 'class' as const, ...(item.abstract ? { abstract: true } : {}), ...(item.stereotype ? { stereotype: item.stereotype } : {}), attributes: item.attributes, operations: item.operations };
    }),
  ];
  if (!elements.length) fail('El diagrama no contiene clases ni namespaces.');
  const diagramTitle = (title?.trim() || titleFromFrontmatter || 'Diagrama importado').slice(0, 120) || 'Diagrama importado';
  const parsed = DiagramInputSchema.safeParse({ type: 'class', title: diagramTitle, elements, relations });
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((issue) => issue.path.join('/') + ': ' + issue.message);
    fail('El modelo resultante no es válido: ' + issues.join('; ') + '. Corrige la clase o relación indicada.');
  }
  const checked = validateDiagram(parsed.data);
  if (!checked.ok) {
    const first = checked.errors[0]!;
    fail(first.message + (first.hint ? ' ' + first.hint : ''));
  }
  return { diagram: parsed.data, warnings };
}
