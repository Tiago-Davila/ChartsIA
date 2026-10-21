import { z } from 'zod';
import { elementBaseShape } from './common.js';

/** Entidad ER; `weak: true` es una entidad débil (doble borde). */
export const EntityElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('entity'),
  weak: z.boolean().optional(),
});
