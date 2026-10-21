import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

/** Atributos Chen: clave sin multivaluado/derivado, valores únicos, un solo dueño por pieza y sin ciclos. */
export function checkChen({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];

  diagram.elements.forEach((el, i) => {
    if (el.kind === 'attribute' && el.key) {
      for (const field of ['multivalued', 'derived'] as const) {
        if (el[field]) {
          errors.push(validationError('FIELD_NOT_ALLOWED', `/elements/${i}/${field}`, `El atributo clave "${el.id}" no puede ser ${field === 'derived' ? 'derivado' : 'multivaluado'}.`, `Quita "${field}" o quita "key": una clave identifica a la entidad y se guarda como valor único.`));
        }
      }
    }
    if (el.kind === 'value-list') {
      const seen = new Set<string>();
      el.values.forEach((value, j) => {
        if (seen.has(value)) {
          errors.push(validationError('INVALID_MEMBER', `/elements/${i}/values/${j}`, `La lista "${el.id}" repite el valor "${value}".`, 'Cada valor de la lista debe ser distinto: elimina el repetido.'));
        }
        seen.add(value);
      });
    }
  });

  // Dueño de cada atributo o lista: el source de la er-attr que llega a él.
  const owner = new Map<string, string>();
  diagram.relations.forEach((rel, i) => {
    if (rel.kind !== 'er-attr') return;
    const target = elementsById.get(rel.target);
    if (target?.kind !== 'attribute' && target?.kind !== 'value-list') return;
    if (owner.has(rel.target)) {
      errors.push(validationError('RELATION_NOT_ALLOWED', `/relations/${i}/target`, `"${rel.target}" ya cuelga de "${owner.get(rel.target)}"; no puede tener dos dueños.`, `Elimina la er-attr "${rel.id}" o usa un ${target.kind} distinto para cada dueño.`));
    } else owner.set(rel.target, rel.source);
  });

  // Un atributo compuesto no puede colgar de sus propios sub-atributos, ni directa ni indirectamente.
  const reported = new Set<string>();
  diagram.relations.forEach((rel, i) => {
    if (rel.kind !== 'er-attr' || owner.get(rel.target) !== rel.source || reported.has(rel.target)) return;
    const path = new Set<string>([rel.target]);
    for (let cur = rel.source; owner.has(cur); cur = owner.get(cur)!) {
      if (path.has(cur)) {
        path.forEach((id) => reported.add(id));
        errors.push(validationError('RELATION_NOT_ALLOWED', `/relations/${i}`, `La er-attr "${rel.id}" cierra un ciclo de atributos en "${rel.target}".`, 'Un atributo compuesto no puede colgar de sus propios sub-atributos: elimina esta relación.'));
        break;
      }
      path.add(cur);
    }
  });
  return errors;
}
