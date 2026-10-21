import { z } from 'zod';
import { BOUNDARY_TYPES, CARDINALITIES, CONTAINER_VARIANTS, MAX_OPERATIONS_PER_BATCH, NAVIGABILITIES, RELATION_KINDS, SIDES } from './enums.js';
import { AttributeSchema, MethodSchema } from './class-elements.js';
import { DescriptionSchema, ElementIdSchema, LayoutSchema, NameSchema, PointSchema } from './common.js';
import { ElementSchema, TitleSchema } from './diagram.js';
import { MultiplicitySchema, RelationSchema } from './relation.js';

/**
 * Cambios parciales de un elemento: unión de los campos editables de todos los `kind`.
 * Al aplicarse, el resultado se valida contra el esquema del `kind` existente, así que un
 * campo que ese `kind` no admite se rechaza. `null` elimina un campo opcional.
 */
export const ElementChangesSchema = z
  .strictObject({
    name: NameSchema.optional(),
    description: DescriptionSchema.nullable().optional(),
    parentId: ElementIdSchema.nullable().optional(),
    abstract: z.boolean().nullable().optional(),
    stereotype: z.string().min(1).max(60).nullable().optional(),
    attributes: z.array(AttributeSchema).max(200).optional(),
    operations: z.array(MethodSchema).max(200).optional(),
    literals: z.array(z.string().min(1).max(200)).min(1).max(200).optional(),
    external: z.boolean().nullable().optional(),
    technology: z.string().min(1).max(120).nullable().optional(),
    variant: z.enum(CONTAINER_VARIANTS).nullable().optional(),
    boundaryType: z.enum(BOUNDARY_TYPES).optional(),
    weak: z.boolean().nullable().optional(),
  })
  .describe('Campos a cambiar, p. ej. {"name":"Usuario"}; null elimina un campo opcional');
export type ElementChanges = z.infer<typeof ElementChangesSchema>;

export const RelationChangesSchema = z
  .strictObject({
    kind: z.enum(RELATION_KINDS).optional(),
    source: ElementIdSchema.optional(),
    target: ElementIdSchema.optional(),
    label: z.string().max(200).nullable().optional(),
    sourceMultiplicity: MultiplicitySchema.nullable().optional(),
    targetMultiplicity: MultiplicitySchema.nullable().optional(),
    navigable: z.enum(NAVIGABILITIES).nullable().optional(),
    technology: z.string().min(1).max(120).nullable().optional(),
    sourceCardinality: z.enum(CARDINALITIES).nullable().optional(),
    targetCardinality: z.enum(CARDINALITIES).nullable().optional(),
    identifying: z.boolean().nullable().optional(),
    sourceSide: z.enum(SIDES).nullable().optional(),
    targetSide: z.enum(SIDES).nullable().optional(),
    waypoints: z.array(PointSchema).max(20).nullable().optional(),
  })
  .describe('Campos a cambiar, p. ej. {"label":"usa"}; null elimina un campo opcional');
export type RelationChanges = z.infer<typeof RelationChangesSchema>;

export const OperationSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('add_element'), element: ElementSchema }),
  z.strictObject({ op: z.literal('update_element'), id: ElementIdSchema, changes: ElementChangesSchema }),
  z.strictObject({
    op: z.literal('remove_element'),
    id: ElementIdSchema,
    cascade: z
      .enum(['children', 'reparent'])
      .optional()
      .describe('Solo grupos: "reparent" (defecto) mueve los hijos al padre; "children" los elimina'),
  }),
  z.strictObject({ op: z.literal('add_relation'), relation: RelationSchema }),
  z.strictObject({ op: z.literal('update_relation'), id: ElementIdSchema, changes: RelationChangesSchema }),
  z.strictObject({ op: z.literal('remove_relation'), id: ElementIdSchema }),
  z.strictObject({
    op: z.literal('move_element'),
    id: ElementIdSchema,
    x: LayoutSchema.shape.x,
    y: LayoutSchema.shape.y,
  }),
  z.strictObject({
    op: z.literal('resize_element'),
    id: ElementIdSchema,
    width: z.number().positive().max(5000),
    height: z.number().positive().max(5000),
  }),
  z.strictObject({ op: z.literal('set_title'), title: TitleSchema }),
]);
export type Operation = z.infer<typeof OperationSchema>;

export const OperationBatchSchema = z.array(OperationSchema).min(1).max(MAX_OPERATIONS_PER_BATCH);
