import { type NextFunction, type Request, type Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { hostCheck } from '../../src/common/host-check.js';

/** Ejecuta el middleware con un `Host` dado y devuelve si dejó pasar la petición. */
function pasa(host: string, config: { authRequired?: boolean; publicUrl?: string } = {}): boolean {
  const middleware = hostCheck({ authRequired: false, publicUrl: 'http://chartsia.localhost:3333', ...config });
  const next = vi.fn() as NextFunction;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  middleware({ headers: { host } } as unknown as Request, res, next);
  return vi.mocked(next).mock.calls.length === 1;
}

describe('hostCheck', () => {
  it.each(['127.0.0.1:3333', 'localhost:5173', '[::1]:3333', 'chartsia.localhost:3333', 'chartsia.localhost:5173', 'otra.app.localhost:3333'])('acepta %s', (host) => {
    expect(pasa(host)).toBe(true);
  });

  it.each(['evil.example:3333', 'localhost.evil.example', 'chartsia.localhost.evil.example', 'xlocalhost:3333'])('rechaza %s (DNS rebinding)', (host) => {
    expect(pasa(host)).toBe(false);
  });

  it('acepta el host de CHARTSIA_PUBLIC_URL', () => {
    expect(pasa('mi-hub.lan:3333', { publicUrl: 'http://mi-hub.lan:3333' })).toBe(true);
  });

  it('no filtra cuando se exige token', () => {
    expect(pasa('evil.example', { authRequired: true })).toBe(true);
  });
});
