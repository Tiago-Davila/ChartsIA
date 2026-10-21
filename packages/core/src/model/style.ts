import { z } from 'zod';

/** Familias de fuente permitidas; #202 las ofrece en el panel y #203 las traduce al dibujar. */
export const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace', 'handwritten'] as const;
export type StyleFontFamily = (typeof FONT_FAMILIES)[number];

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 48;

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
    fontColor: ColorSchema.optional().describe('Color del texto'),
    fontFamily: z.enum(FONT_FAMILIES).optional().describe('Familia de fuente del texto'),
    fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).optional().describe('Tamaño del texto en px (8 a 48)'),
  })
  .describe('Estilo visual opcional: colores "#rrggbb", fontFamily de una lista y fontSize entero de 8 a 48');
export type Style = z.infer<typeof StyleSchema>;
