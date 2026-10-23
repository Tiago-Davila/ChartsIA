import { type NextFunction, type Request, type Response } from 'express';
import { type AppConfig } from '../config/config.js';

const LOOPBACK_NAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function hostname(host: string): string {
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]!;
}

/** Acepta loopback y los subdominios `*.localhost`, que los navegadores siempre resuelven a loopback. */
function esLoopback(host: string): boolean {
  return LOOPBACK_NAMES.has(host) || host.endsWith('.localhost');
}

/**
 * Protección contra DNS rebinding cuando el hub no exige token (loopback): solo se aceptan
 * peticiones cuyo `Host` sea loopback, `*.localhost` o el host de `CHARTSIA_PUBLIC_URL`.
 */
export function hostCheck(config: Pick<AppConfig, 'authRequired' | 'publicUrl'>) {
  const publicHost = hostname(new URL(config.publicUrl).host).toLowerCase();
  return (req: Request, res: Response, next: NextFunction) => {
    if (config.authRequired) return next();
    const host = hostname((req.headers.host ?? '').toLowerCase());
    if (esLoopback(host) || host === publicHost) return next();
    res.status(421).json({ errors: [{ code: 'UNAUTHORIZED', path: '', message: `Host no permitido: ${host}`, hint: 'Accede por 127.0.0.1 o define CHARTSIA_PUBLIC_URL.' }] });
  };
}
