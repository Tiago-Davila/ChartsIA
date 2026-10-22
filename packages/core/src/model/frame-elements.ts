import { z } from 'zod';
import { elementBaseShape } from './common.js';

/** Marco genérico para agrupar elementos de cualquier tipo de diagrama. */
export const FrameElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('frame'),
});
