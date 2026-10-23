import { type ElementOfKind } from '../../model/diagram.js';
import { type StyleFontFamily } from '../../model/style.js';
import { type Run, parseMarkdown } from '../text/markdown.js';
import { type TokenKind, highlight } from '../text/highlight.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText, type TextStyle, wrapText } from '../text-metrics.js';
import { COLORS, FONT, type Primitive, type ShapeDefinition } from '../types.js';

type TextElement = ElementOfKind<'text'>;

/** Estilo base de un tramo: tamaño, color y familia; la negrita la añade un título o un `**`. */
interface Base {
  size: number;
  color: string;
  fontFamily?: StyleFontFamily;
}

/** Trozo de texto ya medido; `x` es su posición en la línea, relativa al bloque. */
interface Piece {
  text: string;
  x: number;
  width: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: StyleFontFamily;
}

/** Línea de texto: la altura de su parte superior, su tamaño y los trozos que la forman. */
interface Row {
  top: number;
  size: number;
  pieces: Piece[];
}

/** Recuadro gris de un bloque de código. */
interface Box {
  top: number;
  width: number;
  height: number;
}

interface Layout {
  rows: Row[];
  boxes: Box[];
  width: number;
  height: number;
}

const PADDING = 8;
const MIN_WIDTH = 120;
/** Ancho en px al que se parten los párrafos y los elementos de las listas. */
const WRAP = 360;
const BLOCK_GAP = 10;
const LIST_INDENT = 18;
const CODE_PADDING = 10;
const CODE_CAPTION_SIZE = FONT.small;
export const CODE_FILL = '#f5f7fa';
export const CODE_STROKE = '#d5d9e0';
const HEADING_SCALE: Record<1 | 2 | 3, number> = { 1: 1.7, 2: 1.4, 3: 1.2 };
const CODE_SCALE = 0.9;
/** Colores del resaltado de sintaxis; el texto sin clase usa el color del bloque. */
export const TOKEN_COLORS: Record<TokenKind, string | undefined> = { plain: undefined, keyword: '#7c3aed', string: '#0f7b3c', number: '#b45309', comment: '#6b7280' };

/** Parte los tramos en líneas de como máximo `maxWidth`: corta por palabras y cada palabra conserva su negrita y cursiva. */
function wrapRuns(runs: Run[], base: Base, maxWidth: number, bold = false): Piece[][] {
  const lines: Piece[][] = [];
  let line: Piece[] = [];
  let width = 0;
  let space = false;
  const flush = () => {
    if (line.length > 0) lines.push(line);
    line = [];
    width = 0;
    space = false;
  };
  const spaceWidth = measureText(' ', { size: base.size, fontFamily: base.fontFamily });
  for (const run of runs) {
    const style: TextStyle = { size: base.size, bold: bold || run.bold, fontFamily: base.fontFamily };
    for (const token of run.text.match(/\S+|\s+/g) ?? []) {
      if (/^\s/.test(token)) {
        space = line.length > 0;
        continue;
      }
      const parts = measureText(token, style) > maxWidth ? wrapText(token, maxWidth, style) : [token];
      parts.forEach((part, index) => {
        const partWidth = measureText(part, style);
        const gap = line.length > 0 && space ? spaceWidth : 0;
        if (line.length > 0 && (index > 0 || width + gap + partWidth > maxWidth)) flush();
        const x = line.length > 0 ? width + (space ? spaceWidth : 0) : 0;
        line.push({ text: part, x, width: partWidth, color: base.color, bold: style.bold, italic: run.italic, fontFamily: base.fontFamily });
        width = x + partWidth;
        space = false;
      });
    }
  }
  flush();
  return lines;
}

/** Desplaza en horizontal todos los trozos de una línea. */
function shift(line: Piece[], dx: number): Piece[] {
  return line.map((piece) => ({ ...piece, x: piece.x + dx }));
}

/** Coloca el markdown en filas y recuadros, de arriba abajo, y calcula el ancho y alto totales. */
function layoutTextBlock(el: TextElement): Layout {
  const font = textFont(el.style, FONT.name);
  const color = paintOf(el.style, { fill: 'none', stroke: 'none', text: COLORS.text }).text;
  const body: Base = { size: font.size, color, fontFamily: font.fontFamily };
  const rows: Row[] = [];
  const boxes: Box[] = [];
  let y = PADDING;
  const addRow = (top: number, size: number, pieces: Piece[]) => rows.push({ top, size, pieces });

  parseMarkdown(el.name).forEach((block, index) => {
    if (index > 0) y += BLOCK_GAP;
    if (block.type === 'heading') {
      const base: Base = { ...body, size: Math.round(font.size * HEADING_SCALE[block.level]) };
      for (const line of wrapRuns(block.runs, base, WRAP, true)) {
        addRow(y, base.size, shift(line, PADDING));
        y += lineHeight(base.size);
      }
    } else if (block.type === 'paragraph') {
      for (const runs of block.lines) {
        for (const line of wrapRuns(runs, body, WRAP)) {
          addRow(y, body.size, shift(line, PADDING));
          y += lineHeight(body.size);
        }
      }
    } else if (block.type === 'list') {
      // Con números, la sangría cabe el marcador más ancho de la lista.
      const indent = block.ordered ? Math.max(LIST_INDENT, measureText(`${block.items.length}.`, body) + 8) : LIST_INDENT;
      block.items.forEach((item, n) => {
        const marker = block.ordered ? `${n + 1}.` : '•';
        wrapRuns(item, body, WRAP - indent).forEach((line, k) => {
          const markerPiece: Piece[] = k === 0 ? [{ text: marker, x: PADDING, width: measureText(marker, body), color }] : [];
          addRow(y, body.size, [...markerPiece, ...shift(line, PADDING + indent)]);
          y += lineHeight(body.size);
        });
      });
    } else {
      const size = Math.round(font.size * CODE_SCALE);
      const step = lineHeight(size);
      if (block.language) {
        addRow(y, CODE_CAPTION_SIZE, [{ text: block.language, x: PADDING, width: measureText(block.language, { size: CODE_CAPTION_SIZE }), color: COLORS.muted }]);
        y += lineHeight(CODE_CAPTION_SIZE);
      }
      const top = y;
      const lines = highlight(block.code, block.language);
      let longest = 0;
      lines.forEach((tokens, k) => {
        let x = PADDING + CODE_PADDING;
        const pieces = tokens.map((token): Piece => {
          const width = measureText(token.text, { size, fontFamily: 'monospace' });
          // Los espacios se dibujan como espacios que el SVG no colapsa; la medida usa el texto original.
          const piece: Piece = { text: token.text.replace(/ /g, ' '), x, width, color: TOKEN_COLORS[token.kind] ?? color, fontFamily: 'monospace', italic: token.kind === 'comment' };
          x += width;
          return piece;
        });
        longest = Math.max(longest, x - PADDING - CODE_PADDING);
        addRow(top + CODE_PADDING + k * step, size, pieces);
      });
      const height = lines.length * step + CODE_PADDING * 2;
      boxes.push({ top, width: longest + CODE_PADDING * 2, height });
      y = top + height;
    }
  });

  let right = 0;
  for (const row of rows) for (const piece of row.pieces) right = Math.max(right, piece.x + piece.width);
  for (const box of boxes) right = Math.max(right, PADDING + box.width);
  return { rows, boxes, width: Math.max(MIN_WIDTH, Math.ceil(right + PADDING)), height: Math.ceil(y + PADDING) };
}

/**
 * Bloque de texto con markdown liviano: títulos, negrita, cursiva, listas y bloques de código
 * con resaltado. No tiene marco salvo que el estilo le dé relleno o borde; `name` guarda el markdown.
 */
export const textBlockShape: ShapeDefinition<TextElement> = {
  measure: (el) => {
    const layout = layoutTextBlock(el);
    return { width: layout.width, height: layout.height };
  },
  primitives: (el, size) => {
    const layout = layoutTextBlock(el);
    const c = paintOf(el.style, { fill: 'none', stroke: 'none', text: COLORS.text });
    const framed = el.style?.fillColor !== undefined || el.style?.borderColor !== undefined;
    const out: Primitive[] = [];
    if (framed) out.push({ type: 'rect', x: 0, y: 0, width: size.width, height: size.height, rx: 4, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth });
    for (const box of layout.boxes) {
      out.push({ type: 'rect', x: PADDING, y: box.top, width: box.width, height: box.height, rx: 4, fill: CODE_FILL, stroke: CODE_STROKE, strokeWidth: 1 });
    }
    for (const row of layout.rows) {
      const baseline = row.top + lineHeight(row.size) * 0.75;
      for (const piece of row.pieces) {
        out.push({
          type: 'text',
          x: piece.x,
          y: baseline,
          text: piece.text,
          size: row.size,
          color: piece.color,
          anchor: 'start',
          ...(piece.bold ? { bold: true } : {}),
          ...(piece.italic ? { italic: true } : {}),
          ...(piece.fontFamily ? { fontFamily: piece.fontFamily } : {}),
          slot: 'name',
        });
      }
    }
    return out;
  },
};
