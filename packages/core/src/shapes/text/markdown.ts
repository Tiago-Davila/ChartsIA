/** Tramo de texto con su estilo: negrita y cursiva se marcan con `**` y `*`. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** Bloque del markdown liviano: título, párrafo, lista o bloque de código. */
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; runs: Run[] }
  | { type: 'paragraph'; lines: Run[][] }
  | { type: 'list'; ordered: boolean; items: Run[][] }
  | { type: 'code'; language: string; code: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*-\s+(.*)$/;
const NUMBERED = /^\s*\d+\.\s+(.*)$/;
const FENCE = /^```\s*([\w+#.-]*)\s*$/;
// Los marcadores no se pegan a espacios: "2 * 3 * 4" no es cursiva.
const INLINE = /\*\*(?!\s)(.+?)(?<!\s)\*\*|\*(?!\s)(.+?)(?<!\s)\*/g;

/** Separa negrita (`**x**`) y cursiva (`*x*`); los asteriscos sin cerrar quedan como texto. */
export function parseRuns(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index) });
    if (match[1] !== undefined) runs.push({ text: match[1], bold: true });
    else runs.push({ text: match[2]!, italic: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

/** Convierte el markdown liviano en bloques; las líneas de un párrafo conservan su salto. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = FENCE.exec(line.trim());
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i]!.trim() !== '```') body.push(lines[i++]!);
      i++;
      blocks.push({ type: 'code', language: (fence[1] ?? '').toLowerCase(), code: body.join('\n') });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1]!.length, 3) as 1 | 2 | 3, runs: parseRuns(heading[2]!.trim()) });
      i++;
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    const bullet = BULLET.test(line);
    if (bullet || NUMBERED.test(line)) {
      const pattern = bullet ? BULLET : NUMBERED;
      const items: Run[][] = [];
      while (i < lines.length && pattern.test(lines[i]!)) items.push(parseRuns(pattern.exec(lines[i++]!)![1]!.trim()));
      blocks.push({ type: 'list', ordered: !bullet, items });
      continue;
    }
    const rows: Run[][] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !FENCE.test(lines[i]!.trim()) && !HEADING.test(lines[i]!) && !BULLET.test(lines[i]!) && !NUMBERED.test(lines[i]!)) {
      rows.push(parseRuns(lines[i++]!.trim()));
    }
    blocks.push({ type: 'paragraph', lines: rows });
  }
  return blocks;
}
