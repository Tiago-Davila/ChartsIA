import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { ACCESS_TOKEN, bearerFrom, tokensMatch } from './token.js';

export const PUBLIC_ROUTE = 'chartsia:public';
/** Marca una ruta como accesible sin token (p. ej. `/api/health`). */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

/** Valor inyectado: el token esperado, o `undefined` si no se exige (loopback). */
export type AccessToken = string | undefined;

/**
 * Exige `Authorization: Bearer <token>` solo cuando el hub escucha fuera de loopback
 * (FR-030). El handshake de Socket.IO usa `auth.token` y lo valida el gateway.
 */
@Injectable()
export class BearerGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN) private readonly token: AccessToken,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.token === undefined || context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (tokensMatch(this.token, bearerFrom(request.headers.authorization))) return true;
    throw new UnauthorizedException({
      errors: [{ code: 'UNAUTHORIZED', path: '', message: 'Falta el token de acceso o no es válido.', hint: 'Envía Authorization: Bearer <CHARTSIA_TOKEN>.' }],
    });
  }
}
