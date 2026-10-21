import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentRegistry, EMIT_INTERVAL_MS, MAX_AGENTS, MAX_NAME, MAX_VERSION } from '../../src/agents/agent-registry.js';
import { DiagramEvents } from '../../src/diagrams/diagram-events.js';

describe('AgentRegistry', () => {
  let events: DiagramEvents;
  let registry: AgentRegistry;
  let emitted: number;
  beforeEach(() => {
    vi.useFakeTimers();
    events = new DiagramEvents();
    emitted = 0;
    events.subscribe((e) => e.name === 'agents.changed' && emitted++);
    registry = new AgentRegistry(events);
  });
  afterEach(() => vi.useRealTimers());

  it('da de alta un agente, lo lista sin id de sesión y emite agents.changed', () => {
    const sessionId = registry.register({ name: 'claude-code', version: '2.1.0' });
    expect(sessionId).toBeTruthy();
    expect(registry.list()).toEqual([{ id: 1, name: 'claude-code', version: '2.1.0', lastCallAt: expect.any(String) }]);
    expect(JSON.stringify(registry.list())).not.toContain(sessionId!);
    expect(emitted).toBe(1);
  });

  it('actualiza la última llamada y limita los eventos por intervalo', () => {
    const sessionId = registry.register({ name: 'a', version: '1' })!;
    const first = registry.list()[0]!.lastCallAt;
    vi.advanceTimersByTime(500);
    registry.touch(sessionId);
    expect(registry.list()[0]!.lastCallAt).not.toBe(first);
    expect(emitted).toBe(1);
    vi.advanceTimersByTime(EMIT_INTERVAL_MS);
    registry.touch(sessionId);
    expect(emitted).toBe(2);
  });

  it('ignora sesiones desconocidas y clientInfo sin nombre', () => {
    registry.touch('no-existe');
    expect(registry.register({ version: '1' })).toBeUndefined();
    expect(registry.register(undefined)).toBeUndefined();
    expect(registry.list()).toEqual([]);
    expect(emitted).toBe(0);
  });

  it('trunca nombre y versión, quita caracteres de control y exige texto', () => {
    registry.register({ name: `x\n${'n'.repeat(500)}`, version: 'v'.repeat(500) });
    registry.register({ name: { toString: 'no' }, version: 1 });
    const [agent] = registry.list();
    expect(agent!.name).toHaveLength(MAX_NAME);
    expect(agent!.name).not.toContain('\n');
    expect(agent!.version).toHaveLength(MAX_VERSION);
    expect(registry.list()).toHaveLength(1);
  });

  it('respeta el tope y descarta primero al que lleva más tiempo sin llamar', () => {
    const first = registry.register({ name: 'viejo', version: '1' })!;
    for (let i = 0; i < MAX_AGENTS - 1; i++) registry.register({ name: `a${i}`, version: '1' });
    registry.touch(first); // ya no es el más antiguo
    registry.register({ name: 'nuevo', version: '1' });
    const names = registry.list().map((a) => a.name);
    expect(names).toHaveLength(MAX_AGENTS);
    expect(names).toContain('viejo');
    expect(names).not.toContain('a0');
    expect(names[0]).toBe('nuevo');
  });
});
