import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AppConfig {
  port: number;
  host: string;
  token: string | undefined;
  dataDir: string;
  maxElements: number;
  maxRequestBytes: number;
  publicUrl: string;
  webOrigin: string;
  webDistDir: string | undefined;
  /** El token solo se exige cuando el hub escucha fuera de loopback (FR-030). */
  authRequired: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1']);

export function isLoopback(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase()) || /^127\./.test(host);
}

function intFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo (recibido "${raw}")`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = intFromEnv(env, 'CHARTSIA_PORT', 3333);
  const host = env.CHARTSIA_HOST || '127.0.0.1';
  const urlHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  // En loopback la dirección usa el nombre de la app: `*.localhost` resuelve a loopback sin tocar /etc/hosts.
  const publicHost = isLoopback(urlHost) ? 'chartsia.localhost' : urlHost;
  return {
    port,
    host,
    token: env.CHARTSIA_TOKEN || undefined,
    dataDir: env.CHARTSIA_DATA_DIR || join(homedir(), '.chartsia', 'diagrams'),
    maxElements: intFromEnv(env, 'CHARTSIA_MAX_ELEMENTS', 500),
    maxRequestBytes: intFromEnv(env, 'CHARTSIA_MAX_REQUEST_BYTES', 8 * 1024 * 1024),
    publicUrl: (env.CHARTSIA_PUBLIC_URL || `http://${publicHost}:${port}`).replace(/\/+$/, ''),
    webOrigin: env.CHARTSIA_WEB_ORIGIN || 'http://127.0.0.1:5173',
    webDistDir: env.CHARTSIA_WEB_DIST || undefined,
    authRequired: !isLoopback(host),
  };
}
