import { type ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { type Response } from 'express';
import { isDomainValidationError, type ValidationError } from '@chartsia/core/validation';

const STATUS_BY_CODE: Partial<Record<ValidationError['code'], number>> = {
  DIAGRAM_NOT_FOUND: HttpStatus.NOT_FOUND,
  NO_ACTIVE_DIAGRAM: HttpStatus.NOT_FOUND,
};

type BodyParserError = { type?: string; limit?: number };

/**
 * Traduce errores de dominio y del parseo del cuerpo al contrato `{ errors }`:
 * - `ValidationError[]` → 422; diagrama inexistente → 404.
 * - cuerpo mayor que `CHARTSIA_MAX_REQUEST_BYTES` → 413 `LIMIT_EXCEEDED`.
 * - JSON mal formado → 400 `SCHEMA_VIOLATION`.
 * El resto sigue el tratamiento por defecto de Nest.
 */
@Catch()
export class DomainExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return super.catch(exception, host);
    const response = host.switchToHttp().getResponse<Response>();
    if (isDomainValidationError(exception)) {
      const status = exception.errors.map((e) => STATUS_BY_CODE[e.code]).find((s) => s !== undefined) ?? HttpStatus.UNPROCESSABLE_ENTITY;
      response.status(status).json({ errors: exception.errors });
      return;
    }
    const body = exception as BodyParserError;
    if (body?.type === 'entity.too.large') {
      response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        errors: [{
          code: 'LIMIT_EXCEEDED', path: '',
          message: `La petición supera el máximo de ${body.limit ?? ''} bytes (CHARTSIA_MAX_REQUEST_BYTES).`.replace('  ', ' '),
          hint: 'Divide el diagrama o envía los cambios en lotes más pequeños.',
        }],
      });
      return;
    }
    if (body?.type === 'entity.parse.failed') {
      response.status(HttpStatus.BAD_REQUEST).json({
        errors: [{ code: 'SCHEMA_VIOLATION', path: '', message: 'El cuerpo no es JSON válido.', hint: 'Envía un objeto JSON bien formado.' }],
      });
      return;
    }
    super.catch(exception, host);
  }
}
