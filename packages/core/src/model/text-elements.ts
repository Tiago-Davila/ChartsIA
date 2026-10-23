import { z } from 'zod';
import { elementBaseShape } from './common.js';

/** Largo máximo del texto de un bloque, en caracteres de su markdown. */
export const TEXT_BLOCK_MAX_LENGTH = 4000;

/** Bloque de texto con formato liviano: `name` guarda el markdown que se muestra formateado. */
export const TextElementSchema = z.strictObject({
  ...elementBaseShape,
  name: z
    .string()
    .min(1)
    .max(TEXT_BLOCK_MAX_LENGTH)
    .describe('Markdown liviano: "# Título", "**negrita**", "*cursiva*", listas "- " o "1. " y bloques ```lenguaje con resaltado'),
  kind: z.literal('text'),
});
