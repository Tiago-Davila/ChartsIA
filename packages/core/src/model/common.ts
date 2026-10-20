import { z } from 'zod';

export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export const ElementIdSchema = z
  .string()
  .regex(ID_PATTERN, 'debe empezar por letra y contener solo letras, dígitos, "_" o "-" (máx. 64)')
  .describe('Identificador estable elegido por el agente, p. ej. "Pedido"');

export const PointSchema = z.strictObject({ x: z.number(), y: z.number() });
export type Point = z.infer<typeof PointSchema>;

/**
 * Posición de un elemento. El agente puede enviar solo `{x, y}` para fijar un elemento;
 * el servidor completa `width`, `height` y `pinned`.
 */
export const LayoutSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  pinned: z.boolean().optional(),
});
export type LayoutInput = z.infer<typeof LayoutSchema>;
export interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
  pinned: boolean;
}

export const NameSchema = z.string().min(1).max(200);
export const DescriptionSchema = z.string().max(1000);

/** Campos comunes a todo elemento, sin `kind`. */
export const elementBaseShape = {
  id: ElementIdSchema,
  name: NameSchema,
  description: DescriptionSchema.optional(),
  parentId: ElementIdSchema.optional().describe('Id de un grupo (package/boundary) que lo contiene'),
  layout: LayoutSchema.optional().describe('Opcional: {x, y} fija el elemento en esa posición'),
};
