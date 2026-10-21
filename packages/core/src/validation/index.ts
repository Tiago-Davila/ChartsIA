import { type z } from 'zod';
import { type DiagramContent, type DiagramInput, DiagramInputSchema } from '../model/diagram.js';
import { buildContext, type Rule, type RuleOptions } from './context.js';
import { fromZodError, type ValidationError } from './errors.js';
import { checkInheritanceCycles, checkParentCycles, checkParents } from './rules/hierarchy.js';
import { checkKinds } from './rules/kinds.js';
import { checkMembers } from './rules/members.js';
import { checkLimits } from './rules/limits.js';
import { checkDuplicateIds, checkReferences } from './rules/references.js';
import { checkRelations } from './rules/relations.js';

export * from './errors.js';
export type { RuleOptions } from './context.js';

const RULES: Rule[] = [
  checkLimits,
  checkDuplicateIds,
  checkReferences,
  checkKinds,
  checkMembers,
  checkRelations,
  checkParents,
  checkParentCycles,
  checkInheritanceCycles,
];

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

/** Ejecuta todas las reglas de dominio sobre un contenido ya válido según el esquema. */
export function checkRules(diagram: DiagramContent, options: RuleOptions = {}): ValidationError[] {
  const ctx = buildContext(diagram, options);
  return RULES.flatMap((rule) => rule(ctx));
}

/**
 * Valida una entrada desconocida: primero el esquema (errores `SCHEMA_VIOLATION`) y, si pasa,
 * todas las reglas de dominio. Sin errores devuelve el valor tipado; con alguno, nada.
 */
export function validateDiagram<S extends z.ZodType<DiagramContent> = typeof DiagramInputSchema>(
  input: unknown,
  options: RuleOptions & { schema?: S } = {},
): ValidationResult<S extends typeof DiagramInputSchema ? DiagramInput : z.infer<S>> {
  const schema = options.schema ?? DiagramInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fromZodError(parsed.error) };
  const errors = checkRules(parsed.data, options);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: parsed.data as never };
}
