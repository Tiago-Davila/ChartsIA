import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Dónde se decidió un valor: variable de entorno, `config.json` o el valor por defecto. */
export type ValueSource = 'env' | 'file' | 'default';

/** Configuración del hub guardada en `config.json`, bajo la clave `hub`; lo que falte vale lo de siempre. */
export interface HubFile {
  dataDir?: string;
  maxElements?: number;
  /** `true` hace que el hub escuche fuera de loopback (y exija token). */
  network?: boolean;
  token?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  token: string | undefined;
  dataDir: string;
  /** Archivo de preferencias; por defecto `config.json` junto a la carpeta de datos. */
  configFile: string;
  maxElements: number;
  maxRequestBytes: number;
  publicUrl: string;
  webOrigin: string;
  webDistDir: string | undefined;
  /** El token solo se exige cuando el hub escucha fuera de loopback (FR-030). */
  authRequired: boolean;
  /** De dónde sale cada valor configurable desde la app. */
  sources: { dataDir: ValueSource; maxElements: ValueSource; network: ValueSource; token: ValueSource };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export const DEFAULT_DATA_DIR = join(homedir(), '.chartsia', 'diagrams');
export const DEFAULT_MAX_ELEMENTS = 500;

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

/** Lee la clave `hub` del `config.json`; sin archivo, con JSON roto o con valores inválidos devuelve solo lo válido. */
export function readHubFile(file: string): HubFile {
  let hub: unknown;
  try {
    hub = (JSON.parse(readFileSync(file, 'utf8')) as { hub?: unknown }).hub;
  } catch {
    return {};
  }
  if (!hub || typeof hub !== 'object') return {};
  const { dataDir, maxElements, network, token } = hub as Record<string, unknown>;
  return {
    ...(typeof dataDir === 'string' && dataDir ? { dataDir } : {}),
    ...(Number.isInteger(maxElements) && (maxElements as number) > 0 ? { maxElements: maxElements as number } : {}),
    ...(typeof network === 'boolean' ? { network } : {}),
    ...(typeof token === 'string' && token ? { token } : {}),
  };
}

const sourceOf = (env: unknown, file: unknown): ValueSource => (env ? 'env' : file !== undefined ? 'file' : 'default');

/** Arma la configuración: las variables de entorno mandan, luego `config.json` y por último los valores por defecto. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // La ruta de config.json no depende de lo que diga el archivo (sería circular).
  const baseDataDir = env.CHARTSIA_DATA_DIR || DEFAULT_DATA_DIR;
  const configFile = env.CHARTSIA_CONFIG_FILE || join(dirname(baseDataDir), 'config.json');
  const file = readHubFile(configFile);
  const port = intFromEnv(env, 'CHARTSIA_PORT', 24278);
  const host = env.CHARTSIA_HOST || (file.network ? '0.0.0.0' : '127.0.0.1');
  const urlHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  // En loopback la dirección usa el nombre de la app: `*.localhost` resuelve a loopback sin tocar /etc/hosts.
  const publicHost = isLoopback(urlHost) ? 'chartsia.localhost' : urlHost;
  const dataDir = env.CHARTSIA_DATA_DIR || file.dataDir || baseDataDir;
  return {
    port,
    host,
    // El token guardado solo se usa si el hub escucha en la red; en loopback no se exige.
    token: env.CHARTSIA_TOKEN || (isLoopback(host) ? undefined : file.token),
    dataDir,
    configFile,
    maxElements: intFromEnv(env, 'CHARTSIA_MAX_ELEMENTS', file.maxElements ?? DEFAULT_MAX_ELEMENTS),
    maxRequestBytes: intFromEnv(env, 'CHARTSIA_MAX_REQUEST_BYTES', 8 * 1024 * 1024),
    publicUrl: (env.CHARTSIA_PUBLIC_URL || `http://${publicHost}:${port}`).replace(/\/+$/, ''),
    webOrigin: env.CHARTSIA_WEB_ORIGIN || 'http://127.0.0.1:5173',
    webDistDir: env.CHARTSIA_WEB_DIST || undefined,
    authRequired: !isLoopback(host),
    sources: {
      dataDir: sourceOf(env.CHARTSIA_DATA_DIR, file.dataDir),
      maxElements: sourceOf(env.CHARTSIA_MAX_ELEMENTS, file.maxElements),
      network: sourceOf(env.CHARTSIA_HOST, file.network),
      token: sourceOf(env.CHARTSIA_TOKEN, file.token),
    },
  };
}
