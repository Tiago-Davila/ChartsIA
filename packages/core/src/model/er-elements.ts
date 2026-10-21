import { z } from 'zod';
import { ElementIdSchema, elementBaseShape } from './common.js';

/** Entidad ER; `weak: true` es una entidad débil (doble borde). */
export const EntityElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('entity'),
  weak: z.boolean().optional(),
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
