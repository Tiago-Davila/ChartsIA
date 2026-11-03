import { FLOW_RELATION_KIND } from '../../model/enums.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

/** Cada salida de una decisión necesita etiqueta para saber qué rama es. */
export function checkFlow({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  diagram.relations.forEach((rel, i) => {
    if (rel.kind !== FLOW_RELATION_KIND || rel.label) return;
    const source = elementsById.get(rel.source);
    if (source?.kind !== 'flow-node' || source.variant !== 'decision') return;
    errors.push(
      validationError(
        'FIELD_REQUIRED',
        `/relations/${i}/label`,
        `La conexión "${rel.id}" sale de la decisión "${source.id}" y no tiene etiqueta.`,
        'Agrega "label" con la rama que representa, p. ej. "sí", "no" o el caso.',
      ),
    );
  });
  return errors;
}
