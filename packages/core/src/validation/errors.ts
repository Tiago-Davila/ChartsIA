import { type z } from 'zod';
import { type ErrorCode } from '../model/enums.js';

/** Error de dominio accionable por un LLM (principio IV). */
export interface ValidationError {
  code: ErrorCode;
  /** JSON Pointer (RFC 6901) al campo culpable; "" es la raíz. */
  path: string;
  message: string;
  hint: string;
}

export function validationError(
  code: ErrorCode,
  path: string,
  message: string,
  hint: string,
): ValidationError {
  return { code, path, message, hint };
}

function escapeToken(token: PropertyKey): string {
  return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function toJsonPointer(segments: readonly PropertyKey[]): string {
  return segments.map((s) => '/' + escapeToken(s)).join('');
}

/** Error lanzable que transporta una lista de errores de validación. */
export class DomainValidationError extends Error {
  readonly errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super(errors.map((e) => `${e.code} ${e.path}: ${e.message}`).join('; '));
    this.name = 'DomainValidationError';
    this.errors = errors;
  }
}

export function isDomainValidationError(value: unknown): value is DomainValidationError {
  return value instanceof DomainValidationError;
}

function hintFor(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'unrecognized_keys':
      return `Elimina los campos no admitidos: ${issue.keys.join(', ')}.`;
    case 'invalid_union':
    case 'invalid_value':
      return 'Usa uno de los valores permitidos que indica el esquema de la herramienta.';
    case 'too_small':
    case 'too_big':
      return 'Ajusta la longitud o cantidad a los límites indicados en el mensaje.';
    case 'invalid_format':
      return 'Respeta el formato indicado en el mensaje.';
    case 'invalid_type':
      return issue.input === undefined
        ? 'Añade este campo: es obligatorio.'
        : `Envía un valor de tipo ${issue.expected}.`;
    default:
      return 'Corrige el campo según el esquema de entrada de la herramienta.';
  }
}

/** Convierte los issues de Zod en errores `SCHEMA_VIOLATION` con JSON Pointer. */
export function fromZodError(error: z.ZodError, basePath = ''): ValidationError[] {
  return error.issues.map((issue) =>
    validationError(
      'SCHEMA_VIOLATION',
      basePath + toJsonPointer(issue.path),
      issue.message,
      hintFor(issue),
    ),
  );
}
