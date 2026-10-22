import { type NoSqlField } from '../../model/nosql-elements.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

function pathKey(path: string[]): string {
  return JSON.stringify(path);
}

function isContainer(field: NoSqlField | undefined): boolean {
  return field?.type === 'object' || (field?.type === 'array' && field.itemsType === 'object');
}

/** Valida que cada campo anidado cuelgue de un objeto o array de subdocumentos existente. */
export function checkNoSqlFields({ diagram }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  diagram.elements.forEach((element, elementIndex) => {
    if (element.kind !== 'collection') return;

    const byPath = new Map<string, NoSqlField>();
    element.fields.forEach((field, fieldIndex) => {
      const key = pathKey(field.path);
      if (byPath.has(key)) {
        errors.push(
          validationError(
            'INVALID_NOSQL_FIELD',
            `/elements/${elementIndex}/fields/${fieldIndex}/path`,
            `La ruta "${field.path.join('.')}" está repetida en la colección "${element.name}".`,
            'Deja una sola definición por ruta dentro de la colección.',
          ),
        );
      } else {
        byPath.set(key, field);
      }
    });

    element.fields.forEach((field, fieldIndex) => {
      if (field.path.length === 1) return;
      const parent = byPath.get(pathKey(field.path.slice(0, -1)));
      if (!parent) {
        errors.push(
          validationError(
            'INVALID_NOSQL_FIELD',
            `/elements/${elementIndex}/fields/${fieldIndex}/path`,
            `No existe el campo padre de "${field.path.join('.')}" en la colección "${element.name}".`,
            'Agrega primero el campo padre como object o array con itemsType "object".',
          ),
        );
      } else if (!isContainer(parent)) {
        errors.push(
          validationError(
            'INVALID_NOSQL_FIELD',
            `/elements/${elementIndex}/fields/${fieldIndex}/path`,
            `El padre de "${field.path.join('.')}" no es un subdocumento.`,
            'Cuelga los campos anidados de un campo object o de un array con itemsType "object".',
          ),
        );
      }
    });
  });
  return errors;
}
