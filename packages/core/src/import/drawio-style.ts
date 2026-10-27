import { FONT_SIZE_MAX, FONT_SIZE_MIN, type Style, type StyleFontFamily } from '../model/style.js';
import { C4_PALETTE } from '../shapes/c4/palette.js';
import { FONT } from '../shapes/types.js';

const DEFAULT_COLORS = new Set(
  [
    '#fff6d6', '#fffef5', '#1f2933', '#8492a6', '#475569', '#707070', '#404040', '#444444',
    ...Object.values(C4_PALETTE).flatMap((c) => [c.fill, c.stroke, c.text]),
  ].map((color) => color.toLowerCase()),
);

/** Color "#rrggbb" válido del estilo draw.io (expande "#rgb"), o `undefined` si no hay o no es hexadecimal. */
function hexColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(value);
  return short ? '#' + short[1]! + short[1]! + short[2]! + short[2]! + short[3]! + short[3]! : undefined;
}

/** Familia de fuente del modelo que más se parece a la de draw.io. */
function fontFamilyOf(value: string | undefined): StyleFontFamily | undefined {
  const name = value?.toLowerCase();
  if (!name) return undefined;
  if (/comic|hand|script|cursive/.test(name)) return 'handwritten';
  if (/courier|mono|consolas/.test(name)) return 'monospace';
  if (/times|georgia|garamond/.test(name) && !/sans/.test(name)) return 'serif';
  if (/serif/.test(name) && !/sans/.test(name)) return 'serif';
  if (/helvetica|arial|sans|verdana|tahoma|segoe|inter/.test(name)) return 'sans-serif';
  return undefined;
}

/** Estilo del modelo a partir del estilo draw.io, sin los colores por defecto de los exportadores; `fontBase` es el tamaño del texto sin estilo. */
export function importStyle(style: Map<string, string>, fontBase: number = FONT.name): Style | undefined {
  const out: Style = {};
  const stroke = hexColor(style.get('strokeColor'));
  if (stroke && !DEFAULT_COLORS.has(stroke.toLowerCase())) out.borderColor = stroke;
  const fill = hexColor(style.get('fillColor'));
  if (fill && !DEFAULT_COLORS.has(fill.toLowerCase())) out.fillColor = fill;
  const font = hexColor(style.get('fontColor'));
  if (font && !DEFAULT_COLORS.has(font.toLowerCase())) out.fontColor = font;
  const width = parseFloat(style.get('strokeWidth') ?? '');
  if (Number.isFinite(width)) out.lineWidth = width <= 1.25 ? 'thin' : width <= 2.25 ? 'medium' : 'thick';
  const family = fontFamilyOf(style.get('fontFamily'));
  if (family) out.fontFamily = family;
  const size = parseFloat(style.get('fontSize') ?? '');
  if (Number.isFinite(size) && Math.round(size) !== fontBase) {
    out.fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round((size * FONT.name) / fontBase)));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
