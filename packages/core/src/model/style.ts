import { z } from 'zod';

/** Familias de fuente permitidas; #202 las ofrece en el panel y #203 las traduce al dibujar. */
export const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace', 'handwritten'] as const;
export type StyleFontFamily = (typeof FONT_FAMILIES)[number];

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 48;

/** Grosores de trazo permitidos para los bordes de las figuras y las líneas de las flechas. */
export const LINE_WIDTHS = ['thin', 'medium', 'thick'] as const;
export type StyleLineWidth = (typeof LINE_WIDTHS)[number];

/** Grosor en px de cada opción; "medium" es el grosor de siempre, así que sin estilo nada cambia. */
export const LINE_WIDTH_PX: Record<StyleLineWidth, number> = { thin: 1, medium: 1.5, thick: 3 };

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const ColorSchema = z.string().regex(HEX_COLOR_PATTERN, 'color como "#rrggbb", p. ej. "#1f77b4"');

/**
 * Estilo visual opcional de un elemento o relación. En una relación, `borderColor` es el color
 * de la línea y `fillColor` el de relleno de sus marcas (rombos, puntas).
 */
export const StyleSchema = z
  .strictObject({
    borderColor: ColorSchema.optional().describe('Color del borde (o de la línea en una relación)'),
    fillColor: ColorSchema.optional().describe('Color de relleno'),
    lineWidth: z.enum(LINE_WIDTHS).optional().describe('Grosor del borde (o de la línea en una relación): thin, medium o thick'),
    fontColor: ColorSchema.optional().describe('Color del texto'),
    fontFamily: z.enum(FONT_FAMILIES).optional().describe('Familia de fuente del texto'),
    fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional().describe('Tamaño del texto en px (8 a 48)'),
  })
  .describe('Estilo visual opcional: colores "#rrggbb", lineWidth (thin, medium, thick), fontFamily de una lista y fontSize entero de 8 a 48');
export type Style = z.infer<typeof StyleSchema>;
