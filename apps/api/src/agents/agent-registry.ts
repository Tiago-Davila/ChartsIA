import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DiagramEvents } from '../diagrams/diagram-events.js';

export interface ConnectedAgent {
  id: number;
  name: string;
  version: string;
  /** Hora ISO de la última llamada MCP de la sesión. */
  lastCallAt: string;
}

export const MAX_AGENTS = 50;
export const MAX_NAME = 64;
export const MAX_VERSION = 32;
/** El evento por llamada se emite como mucho una vez cada tanto por sesión. */
export const EMIT_INTERVAL_MS = 2000;

interface Entry extends ConnectedAgent {
  emittedAt: number;
}

/** Deja solo texto imprimible y lo recorta: el `clientInfo` lo manda el cliente y no es de fiar. */
function clean(value: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
}

/** Registro en memoria de las sesiones MCP vistas (no se persiste ni expira al cerrarse la sesión). */
@Injectable()
export class AgentRegistry {
  // Map conserva el orden de inserción: al llamar se reinserta, y el primero es el más antiguo.
  private readonly sessions = new Map<string, Entry>();
  private nextId = 1;

  constructor(private readonly events: DiagramEvents) {}

  /** Alta de una sesión con el `clientInfo` del `initialize`; devuelve su id, o undefined si no trae nombre. */
  register(clientInfo: unknown): string | undefined {
    const info = (clientInfo ?? {}) as { name?: unknown; version?: unknown };
    const name = clean(info.name, MAX_NAME);
    if (!name) return undefined;
    const sessionId = randomUUID();
    if (this.sessions.size >= MAX_AGENTS) this.sessions.delete(this.sessions.keys().next().value!);
    this.sessions.set(sessionId, {
      id: this.nextId++,
      name,
      version: clean(info.version, MAX_VERSION),
      lastCallAt: new Date().toISOString(),
      emittedAt: Date.now(),
    });
    this.emit();
    return sessionId;
  }

  /** Anota la última llamada de una sesión conocida y avisa a la app, a lo sumo cada EMIT_INTERVAL_MS. */
  touch(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    entry.lastCallAt = new Date().toISOString();
    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, entry);
    if (Date.now() - entry.emittedAt >= EMIT_INTERVAL_MS) this.emit();
  }

  /** Agentes vistos, del más reciente al más antiguo; sin ids de sesión. */
  list(): ConnectedAgent[] {
    return [...this.sessions.values()].reverse().map(({ id, name, version, lastCallAt }) => ({ id, name, version, lastCallAt }));
  }

  private emit(): void {
    const now = Date.now();
    for (const entry of this.sessions.values()) entry.emittedAt = now;
    this.events.emit({ name: 'agents.changed', payload: { agents: this.list() } });
  }
}
