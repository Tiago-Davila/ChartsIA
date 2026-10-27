import { type ErrorCode } from '../model/enums.js';
import { DomainValidationError, validationError } from '../validation/errors.js';

/** Error de importación en el formato común code/path/message/hint; siempre apunta a /source. */
export function drawioError(code: ErrorCode, message: string, hint: string): DomainValidationError {
  return new DomainValidationError([validationError(code, '/source', message, hint)]);
}
