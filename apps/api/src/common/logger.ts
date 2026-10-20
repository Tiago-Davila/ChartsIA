import { type LoggerService } from '@nestjs/common';

type Level = 'debug' | 'info' | 'warn' | 'error';

const SECRET_KEYS = /^(authorization|token|auth|password|secret|cookie)$/i;
const BODY_KEYS = /^(diagram|elements|relations|operations|content|body)$/i;

/** Copia el valor ocultando secretos y, salvo que se pida, los cuerpos de diagramas. */
export function redact(value: unknown, includeBodies = false, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, includeBodies, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) out[key] = '[REDACTED]';
    else if (!includeBodies && BODY_KEYS.test(key)) out[key] = '[omitted]';
    else out[key] = redact(v, includeBodies, depth + 1);
  }
  return out;
}

/** Elimina tokens Bearer que aparezcan dentro de un texto libre. */
export function redactText(text: string): string {
  return text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
}

export interface JsonLoggerOptions {
  level?: Level;
  includeBodies?: boolean;
  write?: (line: string) => void;
}

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Logger JSON de una línea por evento, compatible con el `LoggerService` de Nest. */
export class JsonLogger implements LoggerService {
  private readonly min: number;
  private readonly includeBodies: boolean;
  private readonly write: (line: string) => void;

  constructor(options: JsonLoggerOptions = {}) {
    this.min = ORDER[options.level ?? 'info'];
    this.includeBodies = options.includeBodies ?? false;
    this.write = options.write ?? ((line) => process.stderr.write(line + '\n'));
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.emit('info', message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.emit('error', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.emit('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }

  private emit(level: Level, message: unknown, rest: unknown[]): void {
    if (ORDER[level] < this.min) return;
    const context = typeof rest[rest.length - 1] === 'string' ? (rest.pop() as string) : undefined;
    const entry: Record<string, unknown> = { time: new Date().toISOString(), level };
    if (context) entry.context = context;
    if (typeof message === 'string') entry.msg = redactText(message);
    else entry.data = redact(message, this.includeBodies);
    if (rest.length > 0) entry.extra = redact(rest, this.includeBodies);
    this.write(JSON.stringify(entry));
  }
}
