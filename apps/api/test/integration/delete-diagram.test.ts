import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiagramCommandService } from '../../src/diagrams/diagram-command.service.js';
import { body, sampleDiagram, startHub, type TestHub } from '../support/hub.js';

const TOKEN = 'token-de-prueba-suficientemente-largo-123456';

describe('API REST para eliminar un diagrama', () => {
  let hub: TestHub;
  let socket: Socket;
  const json = (path: string, method = 'GET', data?: unknown) =>
    fetch(`${hub.url}${path}`, { method, headers: { 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const createDiagram = async () => (await hub.app.get(DiagramCommandService).create(sampleDiagram)).diagram.id;

  beforeAll(async () => {
    hub = await startHub();
    socket = io(`${hub.url}/live`, { path: '/socket.io', transports: ['websocket'] });
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
  });
  afterAll(async () => {
    socket.close();
    await hub.close();
  });

  it('DELETE borra el diagrama del listado, de GET y del disco, y avisa por Socket.IO', async () => {
    const id = await createDiagram();
    const deleted = new Promise<{ diagramId: string }>((resolve) => socket.once('diagram.deleted', resolve));
    const res = await json(`/api/diagrams/${id}`, 'DELETE');
    expect(res.status).toBe(204);
    expect(await deleted).toEqual({ diagramId: id });
    expect((await json(`/api/diagrams/${id}`)).status).toBe(404);
    expect((await body(await json('/api/diagrams'))).diagrams.map((d: { diagramId: string }) => d.diagramId)).not.toContain(id);
    expect(existsSync(join(hub.dataDir, `${id}.json`))).toBe(false);
  });

  it('un diagrama inexistente o un id malicioso responde 404 DIAGRAM_NOT_FOUND', async () => {
    for (const path of ['/api/diagrams/dg_zzzzzzzzzzzz', '/api/diagrams/..%2F..%2Findex']) {
      const res = await json(path, 'DELETE');
      expect(res.status, path).toBe(404);
      expect((await body(res)).errors[0]).toMatchObject({ code: 'DIAGRAM_NOT_FOUND', message: expect.any(String), hint: expect.any(String) });
    }
  });
});

describe('eliminar un diagrama fuera de loopback', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_TOKEN: TOKEN });
  });
  afterAll(() => hub.close());

  it('sin token válido responde 401 y no borra; con token borra', async () => {
    const id = (await hub.app.get(DiagramCommandService).create(sampleDiagram)).diagram.id;
    expect((await fetch(`${hub.url}/api/diagrams/${id}`, { method: 'DELETE' })).status).toBe(401);
    expect((await fetch(`${hub.url}/api/diagrams/${id}`, { method: 'DELETE', headers: { authorization: 'Bearer otro' } })).status).toBe(401);
    expect(existsSync(join(hub.dataDir, `${id}.json`))).toBe(true);

    const res = await fetch(`${hub.url}/api/diagrams/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(204);
  });
});
