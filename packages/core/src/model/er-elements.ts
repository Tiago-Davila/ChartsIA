import { z } from 'zod';
import { ElementIdSchema, elementBaseShape } from './common.js';

/** Entidad ER; `weak: true` es una entidad débil (doble borde) y `associative: true` una asociativa (borde discontinuo). */
export const EntityElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('entity'),
  weak: z.boolean().optional(),
  associative: z.boolean().optional().describe('Entidad asociativa (borde discontinuo)'),
});

/** Atributo Chen (óvalo): `key` lo subraya, `partialKey` lo subraya en discontinuo, `multivalued` lo dobla y `derived` lo hace discontinuo. */
export const ErAttributeElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('attribute'),
  key: z.boolean().optional().describe('Atributo clave (nombre subrayado); no puede ser multivaluado, derivado ni clave parcial'),
  partialKey: z.boolean().optional().describe('Clave parcial (nombre subrayado discontinuo); no puede ser clave, multivaluado ni derivado'),
  multivalued: z.boolean().optional().describe('Atributo multivaluado (doble óvalo)'),
  derived: z.boolean().optional().describe('Atributo derivado (óvalo discontinuo)'),
});

/** Relación Chen: rombo con el nombre dentro; `identifying: true` lo dibuja de doble borde. */
export const RelationshipElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('relationship'),
  identifying: z.boolean().optional().describe('Relación identificante (rombo de doble borde)'),
});

/** Especialización o generalización: triángulo con la letra d (disjunta, por defecto) u o (solapada) y su nombre debajo. */
export const SpecializationElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('specialization'),
  overlapping: z.boolean().optional().describe('Subclases solapadas (o); sin él, disjuntas (d)'),
});

/** Lista de valores: figura con título y un valor por fila, que se une a un atributo. */
export const ValueListElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('value-list'),
  values: z.array(z.string().min(1).max(200)).min(1).max(200),
});

/** Columna de una tabla; `fk` apunta a la columna PK de otra tabla. */
export const ColumnSchema = z.strictObject({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(200),
  pk: z.boolean().optional(),
  fk: z.strictObject({ table: ElementIdSchema, column: z.string().min(1).max(200) }).optional(),
  notNull: z.boolean().optional(),
  unique: z.boolean().optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

/** Tabla de base de datos: una fila por columna. */
export const TableElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('table'),
  columns: z.array(ColumnSchema).min(1).max(200),
});
