import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sampleDiagram, startHub, type TestHub } from '../support/hub.js';

function next<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('gateway en vivo (Socket.IO /live)', () => {
  let hub: TestHub;
  let socket: Socket;
  let mcp: Client;
  beforeAll(async () => {
    hub = await startHub();
    socket = io(`${hub.url}/live`, { path: '/socket.io', transports: ['websocket'] });
    await next(socket, 'connect');
    mcp = new Client({ name: 'live-test', version: '1.0.0' });
    await mcp.connect(new StreamableHTTPClientTransport(new URL(`${hub.url}/mcp`)));
  });
  afterAll(async () => {
    socket.close();
    await mcp.close();
    await hub.close();
  });

  it('difunde diagram.created y active.changed a todos los clientes', async () => {
    const created = next<{ diagramId: string; title: string; type: string }>(socket, 'diagram.created');
    const active = next<{ diagramId: string }>(socket, 'active.changed');
    const res = await mcp.callTool({ name: 'create_diagram', arguments: sampleDiagram });
    const id = (res.structuredContent as { diagramId: string }).diagramId;
    expect(await created).toEqual({ diagramId: id, title: 'Biblioteca', type: 'class' });
    expect(await active).toEqual({ diagramId: id });
  });

  it('el cliente suscrito recibe diagram.updated tras MCP (agent) y tras REST (app)', async () => {
    const id = ((await mcp.callTool({ name: 'create_diagram', arguments: sampleDiagram })).structuredContent as { diagramId: string }).diagramId;
    expect(await socket.emitWithAck('subscribe', { diagramId: id })).toEqual({ ok: true });

    const fromAgent = next<{ diagramId: string; revision: number; origin: string; diagram: { title: string } }>(socket, 'diagram.updated');
    await mcp.callTool({ name: 'apply_changes', arguments: { diagramId: id, operations: [{ op: 'set_title', title: 'Desde el agente' }] } });
    expect(await fromAgent).toMatchObject({ diagramId: id, revision: 2, origin: 'agent', diagram: { title: 'Desde el agente' } });

    const fromApp = next<{ origin: string; revision: number }>(socket, 'diagram.updated');
    await fetch(`${hub.url}/api/diagrams/${id}/operations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [{ op: 'set_title', title: 'Desde la app' }] }),
    });
    expect(await fromApp).toMatchObject({ origin: 'app', revision: 3 });
  });

  it('un cliente suscrito a otro diagrama no recibe sus cambios', async () => {
    const a = ((await mcp.callTool({ name: 'create_diagram', arguments: sampleDiagram })).structuredContent as { diagramId: string }).diagramId;
    const b = ((await mcp.callTool({ name: 'create_diagram', arguments: sampleDiagram })).structuredContent as { diagramId: string }).diagramId;
    await socket.emitWithAck('subscribe', { diagramId: b });
    const received: unknown[] = [];
    socket.on('diagram.updated', (p) => received.push(p));
    await mcp.callTool({ name: 'apply_changes', arguments: { diagramId: a, operations: [{ op: 'set_title', title: 'x' }] } });
    await new Promise((r) => setTimeout(r, 150));
    socket.off('diagram.updated');
    expect(received).toEqual([]);
  });

  it('difunde projects.changed a todos al crear un proyecto', async () => {
    const changed = next<{ projects: { name: string }[] }>(socket, 'projects.changed');
    await mcp.callTool({ name: 'create_project', arguments: { name: 'En vivo' } });
    expect((await changed).projects).toEqual([expect.objectContaining({ name: 'En vivo' })]);
  });

  it('subscribe con datos inválidos responde ok: false', async () => {
    expect(await socket.emitWithAck('subscribe', { diagramId: 42 })).toEqual({ ok: false });
  });
});
