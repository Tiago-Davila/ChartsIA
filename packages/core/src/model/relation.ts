import { z } from 'zod';
import { ElementIdSchema, PointSchema } from './common.js';
import { StyleSchema } from './style.js';
import { ARROWHEADS, CARDINALITIES, NAVIGABILITIES, RELATION_KINDS, SIDES } from './enums.js';

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
  sourceCardinality: z.enum(CARDINALITIES).optional().describe('Solo er-rel: cardinalidad en el extremo source'),
  targetCardinality: z.enum(CARDINALITIES).optional().describe('Solo er-rel: cardinalidad en el extremo target'),
  identifying: z.boolean().optional().describe('Solo er-rel: true = identificante (línea continua); si no, discontinua'),
  sourceTotal: z.boolean().optional().describe('Solo er-rel y connector: participación total del origen (línea doble en su mitad)'),
  targetTotal: z.boolean().optional().describe('Solo er-rel y connector: participación total del destino (línea doble en su mitad)'),
  arrowheads: z.enum(ARROWHEADS).optional().describe('Solo connector: none (sin punta), end (punta en el destino, por defecto) o both (punta en ambos extremos)'),
  dashed: z.boolean().optional().describe('Solo connector: true = línea discontinua'),
  sourceSide: z.enum(SIDES).optional().describe('Lado del origen por el que sale; sin él se elige solo'),
  targetSide: z.enum(SIDES).optional().describe('Lado del destino por el que entra; sin él se elige solo'),
  waypoints: z.array(PointSchema).max(20).optional().describe('Puntos de quiebre manuales por los que pasa la ruta'),
  style: StyleSchema.optional(),
  route: z.array(PointSchema).max(200).optional().describe('Lo rellena el servidor'),
});
export type Relation = z.infer<typeof RelationSchema>;
