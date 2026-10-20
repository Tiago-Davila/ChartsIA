import { ALLOWED_KINDS_BY_DIAGRAM } from '../../model/enums.js';
import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

export function checkKinds({ diagram }: RuleContext): ValidationError[] {
  const allowed = ALLOWED_KINDS_BY_DIAGRAM[diagram.type];
  const errors: ValidationError[] = [];
  diagram.elements.forEach((el, i) => {
    if (!allowed.includes(el.kind)) {
      errors.push(
        validationError(
          'KIND_NOT_ALLOWED',
          `/elements/${i}/kind`,
          `"${el.kind}" no está permitido en un diagrama "${diagram.type}".`,
          `En "${diagram.type}" usa uno de: ${allowed.join(', ')}.`,
        ),
      );
    }
  });
  return errors;
}
