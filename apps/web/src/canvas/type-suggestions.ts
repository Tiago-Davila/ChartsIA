import { type Diagram } from '@chartsia/core/model';

/** Tipos habituales de Java y C++, sin repetir. */
export const COMMON_TYPES = [
  'int', 'long', 'short', 'byte', 'float', 'double', 'char', 'boolean', 'bool',
  'unsigned int', 'unsigned long', 'long long', 'size_t', 'auto',
  'String', 'std::string', 'Object', 'Integer', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Character', 'Boolean',
  'BigDecimal', 'LocalDate', 'LocalDateTime', 'Date', 'UUID',
  'List<>', 'ArrayList<>', 'LinkedList<>', 'Set<>', 'HashSet<>', 'Map<>', 'HashMap<>', 'Optional<>',
  'std::vector<>', 'std::list<>', 'std::set<>', 'std::map<>', 'std::unordered_map<>', 'std::optional<>',
  'std::shared_ptr<>', 'std::unique_ptr<>',
];

export type TypeSlot = 'attribute' | 'parameter' | 'return';

export interface TypeContext {
  slot: TypeSlot;
  /** Lo escrito desde el inicio del tipo hasta el cursor. */
  prefix: string;
  /** Rango del texto que se reemplaza al elegir una sugerencia. */
  start: number;
  end: number;
}

const MAX_SUGGESTIONS = 12;

/** Salta los espacios desde `from` sin pasar del cursor. */
function skipSpaces(text: string, from: number, caret: number): number {
  let i = from;
  while (i < caret && text[i] === ' ') i++;
  return i;
}

/** Fin del tipo: el primer delimitador desde el cursor, sin los espacios finales. */
function typeEnd(text: string, caret: number, delimiters: string): number {
  let end = caret;
  while (end < text.length && !delimiters.includes(text[end]!)) end++;
  while (end > caret && text[end - 1] === ' ') end--;
  return end;
}

/** Indica si el cursor está sobre el tipo de un atributo, de un parámetro o del retorno. */
export function typeContext(text: string, caret: number, field: 'attribute' | 'operation'): TypeContext | undefined {
  const before = text.slice(0, caret);
  if (field === 'attribute') {
    const colon = before.indexOf(':');
    if (colon < 0 || before.includes('=', colon)) return undefined;
    const start = skipSpaces(text, colon + 1, caret);
    return { slot: 'attribute', prefix: text.slice(start, caret), start, end: typeEnd(text, caret, '=') };
  }
  const open = before.indexOf('(');
  const close = before.lastIndexOf(')');
  if (open < 0) return undefined;
  if (close > open) {
    const colon = before.indexOf(':', close);
    if (colon < 0) return undefined;
    const start = skipSpaces(text, colon + 1, caret);
    return { slot: 'return', prefix: text.slice(start, caret), start, end: typeEnd(text, caret, '') };
  }
  const paramStart = Math.max(open, before.lastIndexOf(',')) + 1;
  const colon = before.indexOf(':', paramStart);
  if (colon < 0) return undefined;
  const start = skipSpaces(text, colon + 1, caret);
  return { slot: 'parameter', prefix: text.slice(start, caret), start, end: typeEnd(text, caret, ',)') };
}

/** Sugerencias para un tipo: primero las que empiezan con lo escrito y después las que lo contienen. */
export function suggestTypes(context: TypeContext, diagram?: Pick<Diagram, 'elements'>): string[] {
  const own = (diagram?.elements ?? []).filter((e) => ['class', 'interface', 'enum'].includes(e.kind)).map((e) => e.name);
  const all = [...new Set([...(context.slot === 'return' ? ['void'] : []), ...COMMON_TYPES, ...own])];
  const prefix = context.prefix.trim().toLowerCase();
  const starts = all.filter((t) => t.toLowerCase().startsWith(prefix));
  const contains = all.filter((t) => !t.toLowerCase().startsWith(prefix) && t.toLowerCase().includes(prefix));
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

/** Reemplaza el tipo por la sugerencia; en los genéricos deja el cursor entre `<>`. */
export function applySuggestion(text: string, context: TypeContext, type: string): { text: string; caret: number } {
  const next = text.slice(0, context.start) + type + text.slice(context.end);
  const caret = context.start + (type.endsWith('<>') ? type.length - 1 : type.length);
  return { text: next, caret };
}
