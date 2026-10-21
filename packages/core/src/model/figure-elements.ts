import { z } from 'zod';
import { elementBaseShape } from './common.js';
import { FIGURE_SHAPES } from './enums.js';

/** Figura general: `shape` elige la forma y `name` es el texto centrado dentro de ella. */
export const FigureElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('figure'),
  shape: z.enum(FIGURE_SHAPES),
});
