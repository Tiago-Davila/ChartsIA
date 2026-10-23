import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiagramCommandService } from '../../src/diagrams/diagram-command.service.js';
import { body, sampleDiagram, startHub, type TestHub } from '../support/hub.js';

const TOKEN = 'token-de-prueba-suficientemente-largo-123456';

describe('API REST de proyectos', () => {
  let hub: TestHub;
  let diagramId: string;
  const json = (path: string, method = 'GET', data?: unknown) =>
    fetch(`${hub.url}${path}`, { method, headers: { 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });

  beforeAll(async () => {
    hub = await startHub();
    diagramId = (await hub.app.get(DiagramCommandService).create(sampleDiagram)).diagram.id;
  });
  afterAll(() => hub.close());

  it('crear, listar, renombrar, mover y borrar', async () => {
    const created = await json('/api/projects', 'POST', { name: ' Tienda ' });
    expect(created.status).toBe(201);
    const project = await body(created);
    expect(project).toMatchObject({ id: expect.stringMatching(/^pr_/), name: 'Tienda' });

    expect(await body(await json('/api/projects'))).toEqual({ projects: [project] });

    const renamed = await json(`/api/projects/${project.id}`, 'PATCH', { name: 'Tienda 2' });
    expect(renamed.status).toBe(200);
    expect((await body(renamed)).name).toBe('Tienda 2');

    expect((await json(`/api/diagrams/${diagramId}/project`, 'PUT', { projectId: project.id })).status).toBe(204);
    const list = await body(await json('/api/diagrams'));
    expect(list.diagrams[0].projectId).toBe(project.id);
    expect(list.projects).toHaveLength(1);

    expect((await json(`/api/diagrams/${diagramId}/project`, 'PUT', { projectId: null })).status).toBe(204);
    expect((await body(await json('/api/diagrams'))).diagrams[0].projectId).toBeUndefined();

    await json(`/api/diagrams/${diagramId}/project`, 'PUT', { projectId: project.id });
    expect((await json(`/api/projects/${project.id}`, 'DELETE')).status).toBe(204);
    const after = await body(await json('/api/diagrams'));
    expect(after.projects).toEqual([]);
    expect(after.diagrams[0].projectId).toBeUndefined();
  });

  it('renombrar valida el nombre igual que crear y no cambia el anterior', async () => {
    const project = await body(await json('/api/projects', 'POST', { name: 'Original' }));
    const vacio = await json(`/api/projects/${project.id}`, 'PATCH', { name: '   ' });
    expect(vacio.status).toBe(422);
    expect((await body(vacio)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/name' });
    expect((await json(`/api/projects/${project.id}`, 'PATCH', { name: 'x'.repeat(101) })).status).toBe(422);
    expect((await json(`/api/projects/${project.id}`, 'PATCH', {})).status).toBe(422);
    const listed = (await body(await json('/api/projects'))).projects.find((p: { id: string }) => p.id === project.id);
    expect(listed.name).toBe('Original');
  });

  it('errores con code/message/hint', async () => {
    const empty = await json('/api/projects', 'POST', { name: '  ' });
    expect(empty.status).toBe(422);
    expect((await body(empty)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/name', hint: expect.any(String) });
    expect((await json('/api/projects', 'POST', { name: 'x'.repeat(101) })).status).toBe(422);
    expect((await json('/api/projects', 'POST', { name: 'a', extra: 1 })).status).toBe(422);
    expect((await json('/api/projects', 'POST')).status).toBe(422);

    const missing = await json('/api/projects/pr_zzzzzzzzzzzz', 'PATCH', { name: 'a' });
    expect(missing.status).toBe(404);
    expect((await body(missing)).errors[0]).toMatchObject({ code: 'PROJECT_NOT_FOUND', message: expect.any(String), hint: expect.any(String) });
    expect((await json('/api/projects/..%2F..%2Fx', 'DELETE')).status).toBe(404);
    expect((await json('/api/projects/pr_zzzzzzzzzzzz', 'DELETE')).status).toBe(404);

    expect((await json(`/api/diagrams/${diagramId}/project`, 'PUT', { projectId: 'pr_zzzzzzzzzzzz' })).status).toBe(404);
    expect((await json('/api/diagrams/dg_zzzzzzzzzzzz/project', 'PUT', { projectId: null })).status).toBe(404);
    expect((await json(`/api/diagrams/${diagramId}/project`, 'PUT', {})).status).toBe(422);
    expect((await json(`/api/diagrams/${diagramId}/project`, 'PUT', { projectId: 5 })).status).toBe(422);
  });
});

describe('proyectos fuera de loopback', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_TOKEN: TOKEN });
  });
  afterAll(() => hub.close());

  it('sin token válido las rutas nuevas responden 401; con token funcionan', async () => {
    const calls: [string, string][] = [
      ['GET', '/api/projects'],
      ['POST', '/api/projects'],
      ['PATCH', '/api/projects/pr_aaaaaaaaaaaa'],
      ['DELETE', '/api/projects/pr_aaaaaaaaaaaa'],
      ['PUT', '/api/diagrams/dg_aaaaaaaaaaaa/project'],
    ];
    for (const [method, path] of calls) {
      expect((await fetch(`${hub.url}${path}`, { method })).status, `${method} ${path}`).toBe(401);
      expect((await fetch(`${hub.url}${path}`, { method, headers: { authorization: 'Bearer otro' } })).status).toBe(401);
    }
    const headers = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };
    expect((await fetch(`${hub.url}/api/projects`, { method: 'POST', headers, body: '{"name":"A"}' })).status).toBe(201);
  });
});
