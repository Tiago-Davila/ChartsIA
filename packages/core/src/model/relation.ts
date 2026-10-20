import { z } from 'zod';
import { ElementIdSchema, PointSchema } from './common.js';
import { NAVIGABILITIES, RELATION_KINDS } from './enums.js';

export const MultiplicitySchema = z
  .string()
  .regex(/^(\d+|\*)(\.\.(\d+|\*))?$/, 'multiplicidad como "1", "*", "0..1" o "1..*"');

export const RelationSchema = z.strictObject({
  id: ElementIdSchema,
  kind: z.enum(RELATION_KINDS),
  source: ElementIdSchema,
  target: ElementIdSchema,
  label: z.string().max(200).optional(),
  sourceMultiplicity: MultiplicitySchema.optional(),
  targetMultiplicity: MultiplicitySchema.optional(),
  navigable: z.enum(NAVIGABILITIES).optional(),
  technology: z.string().min(1).max(120).optional(),
  route: z.array(PointSchema).max(200).optional().describe('Lo rellena el servidor'),
});
export type Relation = z.infer<typeof RelationSchema>;
