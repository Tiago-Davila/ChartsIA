import { DEFAULT_MAX_ELEMENTS } from '../../model/enums.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

export function checkLimits({ diagram, options }: RuleContext): ValidationError[] {
  const max = options.maxElements ?? DEFAULT_MAX_ELEMENTS;
  if (diagram.elements.length <= max) return [];
  return [
    validationError(
      'LIMIT_EXCEEDED',
      '/elements',
      `El diagrama tendría ${diagram.elements.length} elementos y el máximo es ${max} (incluye grupos).`,
      `Divide el contenido en varios diagramas de como máximo ${max} elementos.`,
    ),
  ];
}
