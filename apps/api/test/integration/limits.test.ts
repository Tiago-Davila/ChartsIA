import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, startHub, type TestHub } from '../support/hub.js';

const mcpHeaders = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

function createCall(args: unknown) {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_diagram', arguments: args } });
}

describe('límites', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_MAX_REQUEST_BYTES: String(1024 * 1024) });
  });
  afterAll(() => hub.close());

  it('petición > 1 MiB ⇒ 413 LIMIT_EXCEEDED (MCP y REST)', async () => {
    const huge = 'x'.repeat(1024 * 1024 + 10);
    for (const [path, payload] of [
      ['/mcp', createCall({ type: 'class', title: huge, elements: [], relations: [] })],
      ['/api/diagrams/dg_aaaaaaaaaaaa/operations', JSON.stringify({ operations: [{ op: 'set_title', title: huge }] })],
    ] as const) {
      const res = await fetch(`${hub.url}${path}`, { method: 'POST', headers: mcpHeaders, body: payload });
      expect(res.status, path).toBe(413);
      expect((await body(res)).errors[0]).toMatchObject({ code: 'LIMIT_EXCEEDED', message: expect.stringContaining('1048576') });
    }
  });

  it('> 500 elementos ⇒ LIMIT_EXCEEDED con el límite en el mensaje', async () => {
    const elements = Array.from({ length: 501 }, (_, i) => ({ id: `E${i}`, kind: 'enum', name: `E${i}`, literals: ['A'] }));
    const res = await fetch(`${hub.url}/mcp`, { method: 'POST', headers: mcpHeaders, body: createCall({ type: 'class', title: 'Grande', elements, relations: [] }) });
    const result = (await body(res)).result;
    expect(result.isError).toBe(true);
    expect(result.structuredContent.errors[0]).toMatchObject({ code: 'LIMIT_EXCEEDED', message: expect.stringContaining('500') });
  });
});
