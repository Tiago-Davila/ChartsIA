/**
 * Medida de texto determinista basada en tablas fijas de anchos de glifo (en milésimas de em),
 * independiente del navegador y de las fuentes instaladas (research R7). Cubre las dos fuentes
 * empaquetadas: Inter (estilo limpio) y Excalifont (estilo boceto). Los valores son anchos de
 * avance redondeados hacia arriba para que el texto renderizado quepa siempre en la forma.
 */
export type FontFamily = 'clean' | 'sketch';

// Inter Regular, ASCII 32..126.
const INTER = [
  280, 290, 420, 640, 620, 850, 700, 230, 340, 340, 490, 620, 270, 450, 270, 400, // space..'/'
  630, 630, 630, 630, 630, 630, 630, 630, 630, 630, 270, 270, 620, 620, 620, 520, // '0'..'?'
  920, 710, 670, 720, 730, 610, 590, 740, 750, 290, 530, 670, 570, 890, 750, 770, // '@'..'O'
  650, 770, 660, 650, 650, 730, 710, 990, 690, 670, 640, 340, 400, 340, 500, 490, // 'P'..'_'
  410, 570, 610, 550, 610, 580, 370, 610, 600, 260, 260, 540, 260, 890, 600, 600, // '`'..'o'
  610, 610, 390, 530, 370, 600, 550, 800, 540, 550, 530, 370, 290, 370, 620, // 'p'..'~'
];

// Excalifont Regular, ASCII 32..126 (letra manuscrita, más ancha y uniforme).
const EXCALIFONT = [
  300, 330, 470, 760, 640, 860, 780, 260, 420, 420, 560, 640, 300, 520, 300, 520,
  660, 520, 640, 640, 680, 640, 640, 620, 650, 640, 300, 300, 600, 640, 600, 600,
  960, 720, 690, 690, 730, 640, 620, 740, 760, 420, 600, 690, 600, 880, 760, 760,
  660, 790, 690, 680, 680, 740, 700, 960, 700, 680, 690, 420, 520, 420, 560, 600,
  420, 620, 620, 560, 620, 600, 480, 620, 620, 320, 380, 580, 320, 860, 620, 620,
  620, 620, 500, 560, 460, 620, 580, 820, 580, 580, 580, 440, 300, 440, 640,
];

const TABLES: Record<FontFamily, number[]> = { clean: INTER, sketch: EXCALIFONT };
const WIDE = 1000; // CJK, emoji y otros glifos anchos
const FALLBACK = 650;
const BOLD_FACTOR = 1.07;
/** Margen de seguridad frente a diferencias de hinting y kerning entre plataformas. */
const SAFETY = 1.04;

export interface TextStyle {
  size: number;
  bold?: boolean;
  italic?: boolean;
  /** Por defecto `both`: el máximo de ambas fuentes, para que el layout no dependa del estilo. */
  font?: FontFamily | 'both';
}

function glyphWidth(char: string, table: number[]): number {
  const code = char.codePointAt(0)!;
  if (code >= 32 && code <= 126) return table[code - 32]!;
  // Letras latinas con diacríticos: mismo ancho que la base (á → a).
  const base = char.normalize('NFD')[0]!;
  const baseCode = base.codePointAt(0)!;
  if (base !== char && baseCode >= 32 && baseCode <= 126) return table[baseCode - 32]!;
  if (code >= 0x2e80) return WIDE;
  if (char === '«' || char === '»') return 560;
  return FALLBACK;
}

function widthIn(text: string, style: TextStyle, font: FontFamily): number {
  const table = TABLES[font];
  let units = 0;
  for (const char of text) units += glyphWidth(char, table);
  const factor = style.bold ? BOLD_FACTOR : 1;
  return (units / 1000) * style.size * factor * SAFETY;
}

/** Ancho en px de una línea de texto, redondeado hacia arriba a 0,5 px. */
export function measureText(text: string, style: TextStyle): number {
  const font = style.font ?? 'both';
  const width =
    font === 'both' ? Math.max(widthIn(text, style, 'clean'), widthIn(text, style, 'sketch')) : widthIn(text, style, font);
  return Math.ceil(width * 2) / 2;
}

/** Parte un texto en líneas de como máximo `maxWidth` px (corta palabras demasiado largas). */
export function wrapText(text: string, maxWidth: number, style: TextStyle, maxLines = Infinity): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measureText(candidate, style) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let rest = word;
      while (measureText(rest, style) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && measureText(rest.slice(0, cut), style) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && measureText(`${last}…`, style) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

/** Interlineado estándar para un tamaño de fuente. */
export function lineHeight(size: number): number {
  return Math.round(size * 1.45);
}
