import { z } from 'zod';
import { ElementIdSchema, PointSchema } from './common.js';
import { NAVIGABILITIES, RELATION_KINDS, SIDES } from './enums.js';

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
  sourceSide: z.enum(SIDES).optional().describe('Lado del origen por el que sale; sin él se elige solo'),
  targetSide: z.enum(SIDES).optional().describe('Lado del destino por el que entra; sin él se elige solo'),
  waypoints: z.array(PointSchema).max(20).optional().describe('Puntos de quiebre manuales por los que pasa la ruta'),
  route: z.array(PointSchema).max(200).optional().describe('Lo rellena el servidor'),
});
export type Relation = z.infer<typeof RelationSchema>;
