import { z } from 'zod';
import {
  BoundaryElementSchema,
  ComponentElementSchema,
  ContainerElementSchema,
  PersonElementSchema,
  SoftwareSystemElementSchema,
} from './c4-elements.js';
import {
  ClassElementSchema,
  EnumElementSchema,
  InterfaceElementSchema,
  PackageElementSchema,
} from './class-elements.js';
import { EntityElementSchema, ErAttributeElementSchema, TableElementSchema, ValueListElementSchema } from './er-elements.js';
import { type Layout } from './common.js';
import { DIAGRAM_TYPES } from './enums.js';
import { RelationSchema } from './relation.js';

/** Unión de elementos discriminada por `kind` (en JSON Schema se expresa como `anyOf`). */
export const ElementSchema = z.discriminatedUnion('kind', [
  ClassElementSchema,
  InterfaceElementSchema,
  EnumElementSchema,
  PackageElementSchema,
  PersonElementSchema,
  SoftwareSystemElementSchema,
  ContainerElementSchema,
  ComponentElementSchema,
  BoundaryElementSchema,
  EntityElementSchema,
  TableElementSchema,
  ErAttributeElementSchema,
  ValueListElementSchema,
]);

export type ElementInput = z.infer<typeof ElementSchema>;
/** Elemento ya dispuesto: el servidor completa siempre su `layout`. */
export type Element = ElementInput;
export type PositionedElement = Element & { layout: Layout };
export type ElementOfKind<K extends Element['kind']> = Extract<Element, { kind: K }>;

export const DiagramTypeSchema = z.enum(DIAGRAM_TYPES);
export const TitleSchema = z.string().min(1).max(120);

/** Entrada de `create_diagram`: descripción estructural, sin coordenadas obligatorias. */
export const DiagramInputSchema = z.strictObject({
  type: DiagramTypeSchema,
  title: TitleSchema,
  elements: z.array(ElementSchema),
  relations: z.array(RelationSchema),
});
export type DiagramInput = z.infer<typeof DiagramInputSchema>;

export const DIAGRAM_ID_PATTERN = /^dg_[a-z2-7]{12}$/;

export const DiagramSchema = z.strictObject({
  id: z.string().regex(DIAGRAM_ID_PATTERN),
  type: DiagramTypeSchema,
  title: TitleSchema,
  elements: z.array(ElementSchema),
  relations: z.array(RelationSchema),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Diagram = z.infer<typeof DiagramSchema>;

/** Contenido de un diagrama sobre el que se ejecutan las reglas de dominio. */
export type DiagramContent = Pick<Diagram, 'type' | 'elements' | 'relations'>;
