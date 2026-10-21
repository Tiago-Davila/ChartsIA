import { type Style, type StyleFontFamily } from '../model/style.js';
import { FONT } from './types.js';

/** Tamaño al que equivale `style.fontSize` en el texto principal; el resto del texto escala igual. */
const REFERENCE_SIZE = FONT.name;

/** CSS de cada familia de fuente (SVG exportado y app); la manuscrita cae a una cursiva del sistema. */
export const CSS_FONT_FAMILIES: Record<StyleFontFamily, string> = {
  'sans-serif': "Inter, 'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  monospace: "'JetBrains Mono', Consolas, 'Courier New', monospace",
  handwritten: "Excalifont, 'Segoe Print', 'Comic Sans MS', cursive",
};

/** Colores de una forma: los del estilo o, si faltan, los predeterminados. */
export function paintOf(style: Style | undefined, defaults: { fill: string; stroke: string; text: string }) {
  return {
    fill: style?.fillColor ?? defaults.fill,
    stroke: style?.borderColor ?? defaults.stroke,
    text: style?.fontColor ?? defaults.text,
  };
}

/** Tamaño y familia de un texto que mide `size` sin estilo; sirve para medirlo y para dibujarlo. */
export function textFont(style: Style | undefined, size: number): { size: number; fontFamily?: StyleFontFamily } {
  return {
    size: style?.fontSize ? Math.round((size * style.fontSize) / REFERENCE_SIZE) : size,
    ...(style?.fontFamily ? { fontFamily: style.fontFamily } : {}),
  };
}
