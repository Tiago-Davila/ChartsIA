import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, sampleDiagram, startHub, type TestHub } from '../support/hub.js';

describe('API REST /api', () => {
  let hub: TestHub;
  let id: string;
  const json = (path: string, init: RequestInit = {}) =>
    fetch(`${hub.url}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });

  beforeAll(async () => {
    hub = await startHub();
    const commands = hub.app.get((await import('../../src/diagrams/diagram-command.service.js')).DiagramCommandService);
    id = (await commands.create(sampleDiagram)).diagram.id;
  });
  afterAll(() => hub.close());

  it('GET /api/diagrams ⇒ 200 con el activo', async () => {
    const res = await json('/api/diagrams');
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ activeDiagramId: id, diagrams: [{ diagramId: id, title: 'Biblioteca' }] });
  });

  it('GET /api/diagrams/:id ⇒ 200 con layout y route; 404 si no existe', async () => {
    const res = await json(`/api/diagrams/${id}`);
    expect(res.status).toBe(200);
    const d = await body(res);
    expect(d.elements[0].layout).toMatchObject({ width: expect.any(Number) });
    expect(d.relations[0].route.length).toBeGreaterThanOrEqual(2);
    const missing = await json('/api/diagrams/dg_zzzzzzzzzzzz');
    expect(missing.status).toBe(404);
    expect((await body(missing)).errors[0].code).toBe('DIAGRAM_NOT_FOUND');
  });

  it('POST /operations ⇒ 200 con la salida de apply_changes; 422 con errores', async () => {
    const ok = await json(`/api/diagrams/${id}/operations`, {
      method: 'POST',
      body: JSON.stringify({ baseRevision: 1, operations: [{ op: 'move_element', id: 'Libro', x: 10, y: 10 }] }),
    });
    expect(ok.status).toBe(200);
    expect(await body(ok)).toEqual({ diagramId: id, revision: 2, viewUrl: expect.stringContaining(`/d/${id}`), applied: 1, warnings: [] });

    const bad = await json(`/api/diagrams/${id}/operations`, { method: 'POST', body: JSON.stringify({ operations: [{ op: 'remove_relation', id: 'zz' }] }) });
    expect(bad.status).toBe(422);
    expect((await body(bad)).errors[0]).toMatchObject({ code: 'UNKNOWN_REFERENCE', path: '/operations/0/id' });

    const extra = await json(`/api/diagrams/${id}/operations`, { method: 'POST', body: JSON.stringify({ operations: [], admin: true }) });
    expect(extra.status).toBe(422);

    const malformed = await json(`/api/diagrams/${id}/operations`, { method: 'POST', body: '{ no json' });
    expect(malformed.status).toBe(400);
  });

  it('POST /activate ⇒ 204; 404 si no existe', async () => {
    expect((await json(`/api/diagrams/${id}/activate`, { method: 'POST' })).status).toBe(204);
    expect((await json('/api/diagrams/dg_zzzzzzzzzzzz/activate', { method: 'POST' })).status).toBe(404);
  });

  it.each([
    ['svg', 'image/svg+xml', 'biblioteca.svg'],
    ['drawio', 'application/vnd.jgraph.mxfile', 'biblioteca.drawio'],
    ['excalidraw', 'application/vnd.excalidraw+json', 'biblioteca.excalidraw'],
  ])('GET /export?format=%s ⇒ archivo con Content-Disposition', async (format, mime, filename) => {
    const res = await fetch(`${hub.url}/api/diagrams/${id}/export?format=${format}&style=sketch`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(mime);
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="${filename}"`);
    expect((await res.text()).length).toBeGreaterThan(100);
  });

  it('GET /export con formato inválido ⇒ 422', async () => {
    const res = await fetch(`${hub.url}/api/diagrams/${id}/export?format=png`);
    expect(res.status).toBe(422);
    expect((await body(res)).errors[0].path).toBe('/query/format');
  });
});
