import { type Style } from '../../model/style.js';
import { paintOf, textFont } from '../style.js';
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
  /** Estilo del elemento: escala el texto y cambia colores y familia. */
  style?: Style;
}

const PAD_X = 12;
const PAD_Y = 6;
const MIN_WIDTH = 140;
const EMPTY_SECTION = 10;

/** Alto de una línea de texto, según su tamaño y el estilo del elemento. */
export function boxLineHeight(line: Line, style?: Style): number {
  return lineHeight(textFont(style, line.size ?? FONT.member).size);
}

function sectionHeight(lines: Line[], style?: Style): number {
  if (lines.length === 0) return EMPTY_SECTION;
  return PAD_Y * 2 + lines.reduce((h, l) => h + boxLineHeight(l, style), 0);
}

export interface BoxGeometry {
  headerHeight: number;
  sections: { top: number; height: number; lines: { y: number; height: number; line: Line }[] }[];
}

/** Posición de cada compartimento y línea; la usan los exportadores (p. ej. draw.io). */
export function boxGeometry(box: CompartmentBox): BoxGeometry {
  const headerHeight = sectionHeight(box.header, box.style);
  let top = headerHeight;
  const sections = box.sections.map((lines) => {
    const height = sectionHeight(lines, box.style);
    let y = top + PAD_Y;
    const placed = lines.map((line) => {
      const h = boxLineHeight(line, box.style);
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
  const widest = Math.max(
    ...lines.map((l) => measureText(l.text, { ...textFont(box.style, l.size ?? FONT.member), bold: l.bold })),
  );
  const width = Math.max(MIN_WIDTH, Math.ceil(widest + PAD_X * 2));
  const height = sectionHeight(box.header, box.style) + box.sections.reduce((h, s) => h + sectionHeight(s, box.style), 0);
  return { width, height };
}

function linePrimitives(lines: Line[], top: number, width: number, style?: Style): Primitive[] {
  const out: Primitive[] = [];
  const color = style?.fontColor ?? COLORS.text;
  let y = top + PAD_Y;
  for (const line of lines) {
    const lh = boxLineHeight(line, style);
    const middle = line.align === 'middle';
    out.push({
      type: 'text',
      x: middle ? width / 2 : PAD_X,
      y: y + lh * 0.72,
      text: line.text,
      ...textFont(style, line.size ?? FONT.member),
      color,
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
  const { style } = box;
  const body = paintOf(style, { fill: COLORS.umlFill, stroke: COLORS.stroke, text: COLORS.text });
  const header = style?.fillColor ?? COLORS.umlHeader;
  const headerHeight = sectionHeight(box.header, style);
  const out: Primitive[] = [
    { type: 'rect', x: 0, y: 0, width, height, fill: body.fill, stroke: body.stroke, strokeWidth: body.strokeWidth },
    { type: 'rect', x: 0, y: 0, width, height: headerHeight, fill: header, stroke: body.stroke, strokeWidth: body.strokeWidth },
    ...linePrimitives(box.header, 0, width, style),
  ];
  let top = headerHeight;
  for (const section of box.sections) {
    out.push({ type: 'line', x1: 0, y1: top, x2: width, y2: top, stroke: body.stroke, strokeWidth: 1 });
    out.push(...linePrimitives(section, top, width, style));
    top += sectionHeight(section, style);
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
