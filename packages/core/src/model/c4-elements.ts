import { z } from 'zod';
import { elementBaseShape } from './common.js';
import { BOUNDARY_TYPES, CONTAINER_VARIANTS } from './enums.js';

const TechnologySchema = z.string().min(1).max(120);

export const PersonElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('person'),
  external: z.boolean().optional(),
});

export const SoftwareSystemElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('software-system'),
  external: z.boolean().optional(),
});

export const ContainerElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('container'),
  technology: TechnologySchema.optional(),
  variant: z.enum(CONTAINER_VARIANTS).optional(),
});

export const ComponentElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('component'),
  technology: TechnologySchema.optional(),
});

export const BoundaryElementSchema = z.strictObject({
  ...elementBaseShape,
  kind: z.literal('boundary'),
  boundaryType: z.enum(BOUNDARY_TYPES),
});
