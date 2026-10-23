export type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment';

export interface Token {
  text: string;
  kind: TokenKind;
}

/** Reglas léxicas de un lenguaje: palabras reservadas y comentarios. */
interface LanguageRules {
  keywords: ReadonlySet<string>;
  ignoreCase?: boolean;
  lineComment?: string;
  blockComment?: boolean;
}

const words = (list: string) => new Set(list.split(' '));

const JS: LanguageRules = {
  keywords: words('abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while with yield'),
  lineComment: '//',
  blockComment: true,
};

const PYTHON: LanguageRules = {
  keywords: words('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'),
  lineComment: '#',
};

const JSON_RULES: LanguageRules = { keywords: words('true false null') };

const SQL: LanguageRules = {
  keywords: words('ALTER AND AS ASC BY CASE CREATE DELETE DESC DISTINCT DROP ELSE END FROM GROUP HAVING IN INDEX INNER INSERT INTO IS JOIN KEY LEFT LIKE LIMIT NOT NULL ON OR ORDER OUTER PRIMARY REFERENCES RIGHT SELECT SET TABLE THEN UNION UPDATE VALUES WHEN WHERE'),
  ignoreCase: true,
  lineComment: '--',
};

/** Lenguajes con reglas propias; cualquier otro usa las genéricas (cadenas y números). */
const LANGUAGES: Record<string, LanguageRules> = {
  ts: JS, typescript: JS, tsx: JS, js: JS, javascript: JS, jsx: JS,
  py: PYTHON, python: PYTHON,
  json: JSON_RULES,
  sql: SQL,
};

const GENERIC: LanguageRules = { keywords: new Set() };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Reglas del lenguaje indicado (en minúsculas); los desconocidos usan las genéricas. */
export function languageRules(language: string): LanguageRules {
  return LANGUAGES[language.toLowerCase()] ?? GENERIC;
}

/** Patrón que reconoce, en orden, comentarios, cadenas, números y palabras; lo demás va de a un carácter. */
function scanner(rules: LanguageRules): RegExp {
  const parts: string[] = [];
  if (rules.blockComment) parts.push(String.raw`/\*[\s\S]*?(?:\*/|$)`);
  if (rules.lineComment) parts.push(`${escapeRegExp(rules.lineComment)}[^\\n]*`);
  parts.push(String.raw`"(?:\\.|[^"\\\n])*"?`, String.raw`'(?:\\.|[^'\\\n])*'?`, '`(?:\\\\.|[^`\\\\])*`?');
  parts.push(String.raw`[\p{L}_$][\p{L}\p{N}_$]*`, String.raw`\d+(?:\.\d+)?`, String.raw`[\s\S]`);
  return new RegExp(parts.join('|'), 'gu');
}

/** Clase de un trozo reconocido por el patrón, según cómo empieza. */
function kindOf(piece: string, rules: LanguageRules): TokenKind {
  if (rules.blockComment && piece.startsWith('/*')) return 'comment';
  if (rules.lineComment && piece.startsWith(rules.lineComment)) return 'comment';
  if (/^["'`]/.test(piece)) return 'string';
  if (/^\d/.test(piece)) return 'number';
  if (/^[\p{L}_$]/u.test(piece)) {
    const word = rules.ignoreCase ? piece.toUpperCase() : piece;
    return rules.keywords.has(word) ? 'keyword' : 'plain';
  }
  return 'plain';
}

/** Parte el código en líneas de tokens, uniendo los trozos contiguos de una misma clase. */
export function highlight(code: string, language: string): Token[][] {
  const rules = languageRules(language);
  const lines: Token[][] = [[]];
  const push = (text: string, kind: TokenKind) => {
    text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part === '') return;
      const line = lines[lines.length - 1]!;
      const last = line[line.length - 1];
      if (last && last.kind === kind) last.text += part;
      else line.push({ text: part, kind });
    });
  };
  for (const match of code.replace(/\r\n?/g, '\n').matchAll(scanner(rules))) {
    push(match[0], kindOf(match[0], rules));
  }
  return lines;
}
