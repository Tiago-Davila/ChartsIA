import { z } from 'zod';
import { elementBaseShape } from './common.js';
import { VISIBILITIES } from './enums.js';

const TypeNameSchema = z.string().min(1).max(200);

export const AttributeSchema = z.strictObject({
  name: z.string().min(1).max(200),
  type: TypeNameSchema.optional(),
  visibility: z.enum(VISIBILITIES),
  static: z.boolean().optional(),
  defaultValue: z.string().max(200).optional(),
});
export type Attribute = z.infer<typeof AttributeSchema>;

export const ParameterSchema = z.strictObject({
  name: z.string().min(1).max(200),
  type: TypeNameSchema.optional(),
});

/** Operación (método) de una clase o interfaz. */
export const MethodSchema = z.strictObject({
  name: z.string().min(1).max(200),
  parameters: z.array(ParameterSchema).max(50),
  returnType: TypeNameSchema.optional(),
  visibility: z.enum(VISIBILITIES),
  static: z.boolean().optional(),
  abstract: z.boolean().optional(),
});
export type Method = z.infer<typeof MethodSchema>;

export const ClassElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('class'),
  abstract: z.boolean().optional(),
  stereotype: z.string().min(1).max(60).optional(),
  attributes: z.array(AttributeSchema).max(200),
  operations: z.array(MethodSchema).max(200),
});

export const InterfaceElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('interface'),
  attributes: z.array(AttributeSchema).max(200).optional(),
  operations: z.array(MethodSchema).max(200),
});

export const EnumElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('enum'),
  literals: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(200)
    .refine((l) => new Set(l).size === l.length, 'los literales deben ser únicos'),
});

export const PackageElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('package'),
});
