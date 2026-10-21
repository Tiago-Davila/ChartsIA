import { type Style, type StyleFontFamily } from '../model/style.js';
import { textFont } from '../shapes/style.js';

/** Fuente de draw.io para cada familia; la manuscrita usa Comic Sans MS porque no necesita descargarse. */
const DRAWIO_FONTS: Record<StyleFontFamily, string> = {
  'sans-serif': 'Helvetica',
  serif: 'Times New Roman',
  monospace: 'Courier New',
  handwritten: 'Comic Sans MS',
};

/** Reemplaza las claves dadas de un estilo draw.io (o las agrega al final) y deja las demás. */
function setKeys(base: string, keys: Record<string, string | undefined>): string {
  let style = base;
  for (const [key, value] of Object.entries(keys)) {
    if (value === undefined) continue;
    style = style.replace(new RegExp(`(^|;)${key}=[^;]*;?`, 'g'), '$1');
    style += `${key}=${value};`;
  }
  return style;
}

/** Aplica al estilo draw.io el color de borde y el de relleno del estilo del usuario. */
export function drawioBox(base: string, style: Style | undefined): string {
  return setKeys(base, {
    strokeColor: style?.borderColor,
    fillColor: style?.fillColor,
    swimlaneFillColor: base.includes('swimlaneFillColor=') ? style?.fillColor : undefined,
  });
}

/** Aplica el color de la línea de una relación. */
export function drawioStroke(base: string, style: Style | undefined): string {
  return setKeys(base, { strokeColor: style?.borderColor });
}

/** Aplica color, familia y tamaño de fuente; `size` es el tamaño del texto sin estilo. */
export function drawioFont(base: string, style: Style | undefined, size: number): string {
  return setKeys(base, {
    fontColor: style?.fontColor,
    fontFamily: style?.fontFamily ? DRAWIO_FONTS[style.fontFamily] : undefined,
    fontSize: style?.fontSize ? String(textFont(style, size).size) : undefined,
  });
}
