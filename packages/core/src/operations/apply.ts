import { type z } from 'zod';
import { type Diagram, type Element, ElementSchema } from '../model/diagram.js';
import { isGroupKind } from '../model/enums.js';
import { type Operation, OperationBatchSchema } from '../model/operations.js';
import { type Relation, RelationSchema } from '../model/relation.js';
import { checkRules, type RuleOptions } from '../validation/index.js';
import { fromZodError, toJsonPointer, validationError, type ValidationError } from '../validation/errors.js';

export type ApplyResult =
  | { ok: true; diagram: Diagram; applied: number }
  | { ok: false; errors: ValidationError[] };

class OperationError extends Error {
  constructor(readonly errors: ValidationError[]) {
    super('operation failed');
  }
}

/** Aplica `changes` (null elimina) sobre una copia de `target`. */
function merge<T extends object>(target: T, changes: Record<string, unknown>): T {
  const out = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null) delete out[key];
    else out[key] = value;
  }
  return out as T;
}

/** Revalida un elemento o relación editado con el esquema de su `kind`. */
function reparse<T>(schema: z.ZodType<T>, value: unknown, base: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const errors = parsed.error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) =>
        validationError(
          'FIELD_NOT_ALLOWED',
          `${base}/changes/${key}`,
          `El campo "${key}" no aplica a este tipo de elemento o relación.`,
          `Elimina "${key}" de changes; consulta los campos del kind en el esquema.`,
        ),
      );
    }
    return fromZodError({ issues: [issue] } as z.ZodError, `${base}/changes`).map((e) => ({
      ...e,
      path: `${base}/changes${toJsonPointer(issue.path)}`,
    }));
  });
  throw new OperationError(errors);
}

function unknownId(base: string, id: string, what: string, known: string[]): never {
  throw new OperationError([
    validationError(
      'UNKNOWN_REFERENCE',
      `${base}/id`,
      `No existe ${what} con id "${id}".`,
      `Usa get_diagram para ver los ids actuales${known.length ? ` (p. ej. ${known.slice(0, 10).join(', ')})` : ''}.`,
    ),
  ]);
}

function descendants(elements: Element[], groupId: string): Set<string> {
  const out = new Set<string>();
  let frontier = [groupId];
  while (frontier.length > 0) {
    const next = elements.filter((e) => e.parentId !== undefined && frontier.includes(e.parentId) && !out.has(e.id));
    next.forEach((e) => out.add(e.id));
    frontier = next.map((e) => e.id);
  }
  return out;
}

interface Draft {
  diagram: Diagram;
  reparented: Set<string>;
}

function applyOne(draft: Draft, op: Operation, base: string): void {
  const d = draft.diagram;
  const findElement = (id: string) => {
    const index = d.elements.findIndex((e) => e.id === id);
    if (index < 0) unknownId(base, id, 'un elemento', d.elements.map((e) => e.id));
    return index;
  };
  const findRelation = (id: string) => {
    const index = d.relations.findIndex((r) => r.id === id);
    if (index < 0) unknownId(base, id, 'una relación', d.relations.map((r) => r.id));
    return index;
  };

  switch (op.op) {
    case 'add_element': {
      const element = { ...op.element };
      if (element.layout) element.layout = { ...element.layout, pinned: true };
      d.elements.push(element);
      return;
    }
    case 'update_element': {
      const index = findElement(op.id);
      d.elements[index] = reparse(ElementSchema, merge(d.elements[index]!, op.changes), base);
      return;
    }
    case 'remove_element': {
      const index = findElement(op.id);
      const removed = d.elements[index]!;
      const gone = new Set([removed.id]);
      if (isGroupKind(removed.kind)) {
        const children = descendants(d.elements, removed.id);
        if (op.cascade === 'children') children.forEach((id) => gone.add(id));
        else {
          d.elements = d.elements.map((e) => {
            if (e.parentId !== removed.id) return e;
            draft.reparented.add(e.id);
            return merge(e, { parentId: removed.parentId ?? null });
          });
        }
      }
      d.elements = d.elements.filter((e) => !gone.has(e.id));
      d.relations = d.relations.filter((r) => !gone.has(r.source) && !gone.has(r.target));
      return;
    }
    case 'add_relation':
      d.relations.push({ ...op.relation });
      return;
    case 'update_relation': {
      const index = findRelation(op.id);
      d.relations[index] = reparse<Relation>(RelationSchema, merge(d.relations[index]!, op.changes), base);
      return;
    }
    case 'remove_relation':
      d.relations.splice(findRelation(op.id), 1);
      return;
    case 'move_element': {
      const index = findElement(op.id);
      const el = d.elements[index]!;
      const prev = el.layout;
      const dx = prev ? op.x - prev.x : 0;
      const dy = prev ? op.y - prev.y : 0;
      d.elements[index] = { ...el, layout: { ...prev, x: op.x, y: op.y, pinned: true } };
      if (isGroupKind(el.kind) && prev && (dx !== 0 || dy !== 0)) {
        const inside = descendants(d.elements, el.id);
        d.elements = d.elements.map((e) =>
          inside.has(e.id) && e.layout ? { ...e, layout: { ...e.layout, x: e.layout.x + dx, y: e.layout.y + dy } } : e,
        );
      }
      return;
    }
    case 'set_title':
      d.title = op.title;
      return;
  }
}

/**
 * Aplica un lote atómico de operaciones (data-model "Operations") sobre una copia del
 * diagrama y valida el resultado. Devuelve el diagrama nuevo o todos los errores; nunca
 * un resultado parcial. No toca `revision` ni posiciones de elementos no afectados.
 */
export function applyOperations(diagram: Diagram, operations: unknown, options: RuleOptions = {}): ApplyResult {
  const parsed = OperationBatchSchema.safeParse(operations);
  if (!parsed.success) return { ok: false, errors: fromZodError(parsed.error, '/operations') };

  // El diagrama es JSON puro: la copia por serialización es suficiente y no depende del entorno.
  const draft: Draft = { diagram: JSON.parse(JSON.stringify(diagram)) as Diagram, reparented: new Set() };
  try {
    parsed.data.forEach((op, i) => applyOne(draft, op, `/operations/${i}`));
  } catch (error) {
    if (error instanceof OperationError) return { ok: false, errors: error.errors };
    throw error;
  }

  const result = draft.diagram;
  const errors = checkRules(result, options).map((e) => {
    const match = /^\/elements\/(\d+)\/parentId$/.exec(e.path);
    const id = match ? result.elements[Number(match[1])]?.id : undefined;
    if (e.code === 'INVALID_PARENT' && id && draft.reparented.has(id)) {
      return {
        ...e,
        hint: `Al borrar el grupo, "${id}" quedó sin un padre válido: usa remove_element con cascade: "children" o mueve antes "${id}" a otro grupo.`,
      };
    }
    return e;
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, diagram: result, applied: parsed.data.length };
}
