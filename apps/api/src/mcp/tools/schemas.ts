import { z } from 'zod';
import { DiagramTypeSchema, ERROR_CODES } from '@chartsia/core/model';

export const DiagramIdSchema = z.string().min(1).max(64).describe('Id devuelto por create_diagram o list_diagrams (p. ej. "dg_k3m9…")');

export const ValidationErrorSchema = z.strictObject({
  code: z.enum(ERROR_CODES),
  path: z.string(),
  message: z.string(),
  hint: z.string(),
});

export const FailureSchema = z.strictObject({ errors: z.array(ValidationErrorSchema) });

export const SummarySchema = z.strictObject({
  diagramId: z.string(),
  type: DiagramTypeSchema,
  title: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});
