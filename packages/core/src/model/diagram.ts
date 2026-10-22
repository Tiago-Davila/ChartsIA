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
import { EntityElementSchema, ErAttributeElementSchema, RelationshipElementSchema, SpecializationElementSchema, TableElementSchema, ValueListElementSchema } from './er-elements.js';
import { type Layout } from './common.js';
import { FigureElementSchema } from './figure-elements.js';
import { DrawingElementSchema } from './drawing-elements.js';
import { ImageElementSchema } from './image-elements.js';
import { CollectionElementSchema } from './nosql-elements.js';
import { FrameElementSchema } from './frame-elements.js';
import { DIAGRAM_TYPES } from './enums.js';
import { RelationSchema } from './relation.js';
import { MAX_DIAGRAM_IMAGE_BYTES, MAX_DIAGRAM_IMAGE_PIXELS, totalImageDataUrlBytes, totalImageRasterPixels } from './image-data.js';

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
  FigureElementSchema,
  DrawingElementSchema,
  ImageElementSchema,
  CollectionElementSchema,
  FrameElementSchema,
  ErAttributeElementSchema,
  ValueListElementSchema,
  RelationshipElementSchema,
  SpecializationElementSchema,
]);

export type ElementInput = z.infer<typeof ElementSchema>;
/** Elemento ya dispuesto: el servidor completa siempre su `layout`. */
export type Element = ElementInput;
export type PositionedElement = Element & { layout: Layout };
export type ElementOfKind<K extends Element['kind']> = Extract<Element, { kind: K }>;

export const DiagramTypeSchema = z.enum(DIAGRAM_TYPES);
export const TitleSchema = z.string().min(1).max(120);

function imageBudget(elements: z.infer<typeof ElementSchema>[], ctx: z.RefinementCtx): void {
  if (totalImageDataUrlBytes(elements) > MAX_DIAGRAM_IMAGE_BYTES) {
    ctx.addIssue({ code: 'custom', path: ['elements'], message: `Las imágenes del diagrama superan el máximo de ${MAX_DIAGRAM_IMAGE_BYTES / 1024 / 1024} MiB.` });
  }
  if (totalImageRasterPixels(elements) > MAX_DIAGRAM_IMAGE_PIXELS) {
    ctx.addIssue({ code: 'custom', path: ['elements'], message: `Las imágenes raster del diagrama superan el máximo de ${MAX_DIAGRAM_IMAGE_PIXELS / 1_000_000} millones de píxeles.` });
  }
}

/** Entrada de `create_diagram`: descripción estructural, sin coordenadas obligatorias. */
export const DiagramInputSchema = z.strictObject({
  type: DiagramTypeSchema,
  title: TitleSchema,
  elements: z.array(ElementSchema),
  relations: z.array(RelationSchema),
}).superRefine(({ elements }, ctx) => imageBudget(elements, ctx));
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
}).superRefine(({ elements }, ctx) => imageBudget(elements, ctx));
export type Diagram = z.infer<typeof DiagramSchema>;

/** Contenido de un diagrama sobre el que se ejecutan las reglas de dominio. */
export type DiagramContent = Pick<Diagram, 'type' | 'elements' | 'relations'>;
