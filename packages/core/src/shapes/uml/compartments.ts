import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type Primitive, type Size } from '../types.js';

export interface Line {
  text: string;
  slot?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number;
  align?: 'start' | 'middle';
}

/** Caja UML de compartimentos: el primero es la cabecera centrada, el resto listas. */
export interface CompartmentBox {
  header: Line[];
  sections: Line[][];
}

const PAD_X = 12;
const PAD_Y = 6;
const MIN_WIDTH = 140;
const EMPTY_SECTION = 10;

function sectionHeight(lines: Line[]): number {
  if (lines.length === 0) return EMPTY_SECTION;
  return PAD_Y * 2 + lines.reduce((h, l) => h + lineHeight(l.size ?? FONT.member), 0);
}

export interface BoxGeometry {
  headerHeight: number;
  sections: { top: number; height: number; lines: { y: number; height: number; line: Line }[] }[];
}

/** Posición de cada compartimento y línea; la usan los exportadores (p. ej. draw.io). */
export function boxGeometry(box: CompartmentBox): BoxGeometry {
  const headerHeight = sectionHeight(box.header);
  let top = headerHeight;
  const sections = box.sections.map((lines) => {
    const height = sectionHeight(lines);
    let y = top + PAD_Y;
    const placed = lines.map((line) => {
      const h = lineHeight(line.size ?? FONT.member);
      const out = { y, height: h, line };
      y += h;
      return out;
    });
    const section = { top, height, lines: placed };
    top += height;
    return section;
  });
  return { headerHeight, sections };
}

export function measureBox(box: CompartmentBox): Size {
  const lines = [box.header, ...box.sections].flat();
  const widest = Math.max(...lines.map((l) => measureText(l.text, { size: l.size ?? FONT.member, bold: l.bold })));
  const width = Math.max(MIN_WIDTH, Math.ceil(widest + PAD_X * 2));
  const height = sectionHeight(box.header) + box.sections.reduce((h, s) => h + sectionHeight(s), 0);
  return { width, height };
}

function linePrimitives(lines: Line[], top: number, width: number): Primitive[] {
  const out: Primitive[] = [];
  let y = top + PAD_Y;
  for (const line of lines) {
    const size = line.size ?? FONT.member;
    const lh = lineHeight(size);
    const middle = line.align === 'middle';
    out.push({
      type: 'text',
      x: middle ? width / 2 : PAD_X,
      y: y + lh * 0.72,
      text: line.text,
      size,
      color: COLORS.text,
      anchor: middle ? 'middle' : 'start',
      ...(line.bold ? { bold: true } : {}),
      ...(line.italic ? { italic: true } : {}),
      ...(line.underline ? { underline: true } : {}),
      ...(line.slot ? { slot: line.slot } : {}),
    });
    y += lh;
  }
  return out;
}

export function boxPrimitives(box: CompartmentBox, size: Size): Primitive[] {
  const { width, height } = size;
  const headerHeight = sectionHeight(box.header);
  const out: Primitive[] = [
    { type: 'rect', x: 0, y: 0, width, height, fill: COLORS.umlFill, stroke: COLORS.stroke, strokeWidth: 1.5 },
    { type: 'rect', x: 0, y: 0, width, height: headerHeight, fill: COLORS.umlHeader, stroke: COLORS.stroke, strokeWidth: 1.5 },
    ...linePrimitives(box.header, 0, width),
  ];
  let top = headerHeight;
  for (const section of box.sections) {
    out.push({ type: 'line', x1: 0, y1: top, x2: width, y2: top, stroke: COLORS.stroke, strokeWidth: 1 });
    out.push(...linePrimitives(section, top, width));
    top += sectionHeight(section);
  }
  return out;
}

export function headerLines(name: string, opts: { stereotype?: string; italic?: boolean; abstract?: boolean }): Line[] {
  const lines: Line[] = [];
  if (opts.abstract) lines.push({ text: '«abstract»', size: FONT.small, align: 'middle', slot: 'abstract' });
  if (opts.stereotype) lines.push({ text: `«${opts.stereotype}»`, size: FONT.small, align: 'middle', slot: 'stereotype' });
  lines.push({ text: name, bold: true, size: FONT.name, align: 'middle', slot: 'name', ...(opts.italic ? { italic: true } : {}) });
  return lines;
}
