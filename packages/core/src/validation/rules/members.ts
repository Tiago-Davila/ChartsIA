import { type RuleContext } from '../context.js';
import { validationError, type ValidationError } from '../errors.js';

/** `default` solo vale en métodos de interfaces, y no se combina con `abstract` ni `static`. */
export function checkMembers({ diagram }: RuleContext): ValidationError[] {
  const errors: ValidationError[] = [];
  diagram.elements.forEach((el, i) => {
    if (!('operations' in el) || !el.operations) return;
    el.operations.forEach((m, j) => {
      if (!m.default) return;
      const path = `/elements/${i}/operations/${j}/default`;
      if (el.kind !== 'interface') {
        errors.push(validationError('INVALID_MEMBER', path, `"default" solo se admite en métodos de interfaces y "${el.id}" es un ${el.kind}.`, 'Quita "default" de este método, o muévelo a una interfaz.'));
      } else if (m.abstract || m.static) {
        errors.push(validationError('INVALID_MEMBER', path, `El método "${m.name}" no puede ser "default" y a la vez ${m.abstract ? 'abstract' : 'static'}.`, 'Un método default tiene cuerpo: quita abstract y static.'));
      }
    });
  });
  return errors;
}
