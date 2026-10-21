import { z } from 'zod';
import { elementBaseShape } from './common.js';
import { isSanitizedImageDataUrl, MAX_IMAGE_DATA_URL_LENGTH } from './image-data.js';

export const ImageDataUrlSchema = z
  .string()
  .max(MAX_IMAGE_DATA_URL_LENGTH)
  .refine(isSanitizedImageDataUrl, 'Debe ser una imagen PNG/JPG válida o un SVG canónico sin contenido activo.')
  .describe('Imagen PNG/JPG o SVG saneado como data URL base64; máximo 5 MiB.');

/** Imagen embebida: solo datos raster o SVG restringido, nunca rutas ni URL remotas. */
export const ImageElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('image'),
  src: ImageDataUrlSchema,
});
