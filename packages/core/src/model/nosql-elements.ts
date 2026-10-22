import { z } from 'zod';
import { elementBaseShape } from './common.js';

export const NOSQL_FIELD_SCALAR_TYPES = ['string', 'number', 'boolean', 'date', 'timestamp', 'objectId', 'reference', 'geopoint', 'null'] as const;
export const NOSQL_ARRAY_ITEM_TYPES = [...NOSQL_FIELD_SCALAR_TYPES, 'object'] as const;
export const NOSQL_MAX_FIELDS = 200;
export const NOSQL_MAX_FIELD_DEPTH = 8;

export const NoSqlFieldNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^(?!__proto__$|constructor$|prototype$)[A-Za-z_][A-Za-z0-9_-]*$/, 'empieza con letra o guion bajo; luego usa letras, dígitos, guion o guion bajo y evita nombres reservados');

export const NoSqlFieldPathSchema = z
  .array(NoSqlFieldNameSchema)
  .min(1)
  .max(NOSQL_MAX_FIELD_DEPTH)
  .describe('Ruta desde el documento, con un segmento por campo; máx. 8 niveles');

const NoSqlScalarFieldSchema = z.strictObject({
  path: NoSqlFieldPathSchema,
  type: z.enum(NOSQL_FIELD_SCALAR_TYPES),
});

const NoSqlObjectFieldSchema = z.strictObject({
  path: NoSqlFieldPathSchema,
  type: z.literal('object'),
});

const NoSqlArrayFieldSchema = z.strictObject({
  path: NoSqlFieldPathSchema,
  type: z.literal('array'),
  itemsType: z.enum(NOSQL_ARRAY_ITEM_TYPES).describe('Tipo de los elementos; object admite campos hijos bajo esta ruta'),
});

export const NoSqlFieldSchema = z.discriminatedUnion('type', [NoSqlScalarFieldSchema, NoSqlObjectFieldSchema, NoSqlArrayFieldSchema]);
export type NoSqlField = z.infer<typeof NoSqlFieldSchema>;

export const NoSqlFieldsSchema = z.array(NoSqlFieldSchema).max(NOSQL_MAX_FIELDS).describe('Campos planos ordenados por ruta; máx. 200 por colección');

/** Colección documental; los subdocumentos y arrays se describen con rutas planas y acotadas. */
export const CollectionElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('collection'),
  fields: NoSqlFieldsSchema,
});
