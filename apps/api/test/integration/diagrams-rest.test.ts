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

  it('POST /undo y /redo ⇒ 200 con la revision nueva; 409 si no hay nada', async () => {
    const before = (await body(await json(`/api/diagrams/${id}`))).revision;
    const undo = await json(`/api/diagrams/${id}/undo`, { method: 'POST' });
    expect(undo.status).toBe(200);
    expect(await body(undo)).toEqual({ diagramId: id, revision: before + 1 });
    expect((await json(`/api/diagrams/${id}/redo`, { method: 'POST' })).status).toBe(200);
    const nothing = await json(`/api/diagrams/${id}/redo`, { method: 'POST' });
    expect(nothing.status).toBe(409);
    expect((await body(nothing)).errors[0].code).toBe('NOTHING_TO_UNDO');
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
    const res = await fetch(`${hub.url}/api/diagrams/${id}/export?format=${format}`);
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

describe('POST /api/diagrams', () => {
  let hub: TestHub;
  const json = (path: string, init: RequestInit = {}) =>
    fetch(`${hub.url}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });

  beforeAll(async () => {
    hub = await startHub();
  });
  afterAll(() => hub.close());

  it('POST /api/diagrams ⇒ 201 con un diagrama vacío que queda activo; 422 si el tipo o el título no valen', async () => {
    const res = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'er', title: 'Vacío' }) });
    expect(res.status).toBe(201);
    const created = await body(res);
    expect(created).toEqual({ diagramId: expect.stringMatching(/^dg_/), revision: 1, viewUrl: expect.stringContaining(`/d/${created.diagramId}`) });
    const diagram = await body(await json(`/api/diagrams/${created.diagramId}`));
    expect(diagram).toMatchObject({ type: 'er', title: 'Vacío', elements: [], relations: [] });
    expect((await body(await json('/api/diagrams'))).activeDiagramId).toBe(created.diagramId);

    const badType = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'secuencia', title: 'X' }) });
    expect(badType.status).toBe(422);
    const noTitle = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'class', title: '' }) });
    expect(noTitle.status).toBe(422);
    const extra = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'class', title: 'X', elements: [] }) });
    expect(extra.status).toBe(422);
    const noProject = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'class', title: 'X', projectId: 'pr_inexistente' }) });
    expect(noProject.status).toBe(404);
  });

  it('con projectId lo coloca en ese proyecto', async () => {
    const project = await body(await json('/api/projects', { method: 'POST', body: JSON.stringify({ name: 'Tienda' }) }));
    const res = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'class', title: 'En proyecto', projectId: project.id }) });
    expect(res.status).toBe(201);
    const list = await body(await json('/api/diagrams'));
    expect(list.diagrams.find((d: { title: string }) => d.title === 'En proyecto')).toMatchObject({ projectId: project.id });
  });

  it('rechaza SVG activo antes de persistirlo', async () => {
    const created = await body(await json('/api/diagrams', {
      method: 'POST',
      body: JSON.stringify({ type: 'class', title: 'Malicioso' }),
    }));
    const src = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
    const response = await json(`/api/diagrams/${created.diagramId}/operations`, {
      method: 'POST',
      body: JSON.stringify({ operations: [{ op: 'add_element', element: { id: 'img', kind: 'image', name: 'Imagen', src } }] }),
    });
    expect(response.status).toBe(422);
    expect((await body(response)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/operations/0/element/src' });
    expect((await body(await json(`/api/diagrams/${created.diagramId}`))).elements).toHaveLength(0);
  });
});
