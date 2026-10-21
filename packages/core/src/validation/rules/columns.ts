import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

/** Columnas únicas por tabla; cada FK apunta a una tabla existente y a una de sus columnas PK. */
export function checkColumns({ diagram, elementsById }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  diagram.elements.forEach((el, i) => {
    if (el.kind !== 'table') return;
    const seen = new Set<string>();
    el.columns.forEach((col, j) => {
      const base = `/elements/${i}/columns/${j}`;
      if (seen.has(col.name)) {
        errors.push(validationError('INVALID_MEMBER', `${base}/name`, `La tabla "${el.id}" repite la columna "${col.name}".`, 'Cada columna de una tabla necesita un nombre distinto: renómbrala o elimínala.'));
      }
      seen.add(col.name);
      if (!col.fk) return;
      const target = elementsById.get(col.fk.table);
      if (!target || target.kind !== 'table') {
        errors.push(validationError('UNKNOWN_REFERENCE', `${base}/fk/table`, `La FK "${col.name}" de "${el.id}" apunta a "${col.fk.table}", que no es una tabla del diagrama.`, 'Usa el id de otra tabla existente.'));
        return;
      }
      const column = target.columns.find((c) => c.name === col.fk!.column);
      if (!column) {
        errors.push(validationError('UNKNOWN_REFERENCE', `${base}/fk/column`, `La tabla "${target.id}" no tiene la columna "${col.fk.column}".`, `Columnas disponibles: ${target.columns.map((c) => c.name).join(', ')}.`));
      } else if (!column.pk) {
        errors.push(validationError('INVALID_MEMBER', `${base}/fk/column`, `La FK "${col.name}" apunta a "${target.id}.${column.name}", que no es PK.`, `Marca "${column.name}" con pk:true o apunta a una columna PK de "${target.id}".`));
      }
    });
  });
  return errors;
}
