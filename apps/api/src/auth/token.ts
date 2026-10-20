import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type AppConfig } from '../config/config.js';

export const TOKEN_FILE = '.token';

export interface TokenState {
  /** `undefined` cuando el hub escucha en loopback y no exige token. */
  token: string | undefined;
  generated: boolean;
}

/**
 * Obtiene el token de acceso (FR-030): `CHARTSIA_TOKEN` o, si falta y el hub escucha fuera de
 * loopback, uno aleatorio que se guarda en `CHARTSIA_DATA_DIR/.token` (modo 600) y se
 * reutiliza en los siguientes arranques.
 */
export async function resolveToken(config: Pick<AppConfig, 'token' | 'dataDir' | 'authRequired'>): Promise<TokenState> {
  if (config.token) return { token: config.token, generated: false };
  if (!config.authRequired) return { token: undefined, generated: false };
  const file = join(config.dataDir, TOKEN_FILE);
  try {
    const stored = (await readFile(file, 'utf8')).trim();
    if (stored.length >= 32) return { token: stored, generated: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const token = randomBytes(32).toString('base64url');
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(file, token + '\n', { encoding: 'utf8', mode: 0o600 });
  return { token, generated: true };
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Comparación en tiempo constante (sobre hashes, para no filtrar la longitud). */
export function tokensMatch(expected: string, received: string | undefined): boolean {
  if (received === undefined) return false;
  return timingSafeEqual(digest(expected), digest(received));
}

export function bearerFrom(header: string | string[] | undefined): string | undefined {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value ? /^Bearer\s+(.+)$/i.exec(value.trim()) : null;
  return match?.[1];
}

/**
 * Aviso de arranque con la URL de la app que incluye el token en el fragmento (no llega al
 * servidor ni a los logs). Se escribe una sola vez, fuera del logger.
 */
export function announceToken(publicUrl: string, state: TokenState, write: (line: string) => void = (l) => process.stderr.write(l)): void {
  if (!state.token) return;
  write(
    [
      '',
      'ChartsIA exige token porque escucha fuera de loopback.',
      `  App:   ${publicUrl}/#token=${state.token}`,
      `  MCP:   Authorization: Bearer ${state.token}`,
      state.generated ? '  (token generado y guardado; defínelo en CHARTSIA_TOKEN para fijarlo)' : '',
      '',
    ].join('\n') + '\n',
  );
}

export const ACCESS_TOKEN = Symbol('ACCESS_TOKEN');
