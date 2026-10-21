import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, startHub, type TestHub } from '../support/hub.js';

describe('agentes conectados', () => {
  let hub: TestHub;
  let socket: Socket;
  beforeAll(async () => {
    hub = await startHub();
    socket = io(`${hub.url}/live`, { path: '/socket.io', transports: ['websocket'] });
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
  });
  afterAll(async () => {
    socket.close();
    await hub.close();
  });

  it('un cliente MCP real aparece en GET /api/agents y en agents.changed, y su última llamada se actualiza', async () => {
    const changed = new Promise<{ agents: { name: string }[] }>((resolve) => socket.once('agents.changed', resolve));
    const client = new Client({ name: 'cliente-de-prueba', version: '9.8.7' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${hub.url}/mcp`)));
    expect((await changed).agents).toEqual([expect.objectContaining({ name: 'cliente-de-prueba' })]);

    const before = (await body(await fetch(`${hub.url}/api/agents`))).agents;
    expect(before).toEqual([{ id: expect.any(Number), name: 'cliente-de-prueba', version: '9.8.7', lastCallAt: expect.any(String) }]);

    await new Promise((r) => setTimeout(r, 20));
    await client.listTools();
    const after = (await body(await fetch(`${hub.url}/api/agents`))).agents;
    expect(after[0].lastCallAt > before[0].lastCallAt).toBe(true);
    await client.close();
  });
});
