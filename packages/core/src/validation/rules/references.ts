import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

export function checkDuplicateIds({ diagram }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, string>();
  const visit = (id: string, path: string) => {
    const first = seen.get(id);
    if (first !== undefined) {
      errors.push(
        validationError(
          'DUPLICATE_ID',
          path,
          `El id "${id}" ya se usa en ${first}.`,
          'Usa un id único en todo el diagrama: elementos y relaciones comparten el mismo espacio de ids.',
        ),
      );
    } else seen.set(id, path);
  };
  diagram.elements.forEach((el, i) => visit(el.id, `/elements/${i}/id`));
  diagram.relations.forEach((rel, i) => visit(rel.id, `/relations/${i}/id`));
  return errors;
}

export function checkReferences({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  const known = () => [...elementsById.keys()].slice(0, 20).join(', ');
  diagram.elements.forEach((el, i) => {
    if (el.parentId !== undefined && !elementsById.has(el.parentId)) {
      errors.push(
        validationError(
          'UNKNOWN_REFERENCE',
          `/elements/${i}/parentId`,
          `El elemento "${el.id}" tiene parentId "${el.parentId}", que no existe.`,
          `Crea primero el grupo "${el.parentId}" o usa el id de un package/boundary existente.`,
        ),
      );
    }
  });
  diagram.relations.forEach((rel, i) => {
    for (const end of ['source', 'target'] as const) {
      if (!elementsById.has(rel[end])) {
        errors.push(
          validationError(
            'UNKNOWN_REFERENCE',
            `/relations/${i}/${end}`,
            `La relación "${rel.id}" tiene ${end} "${rel[end]}", que no es un elemento del diagrama.`,
            `Añade el elemento "${rel[end]}" en el mismo lote o usa un id existente (${known()}).`,
          ),
        );
      }
    }
  });
  return errors;
}
