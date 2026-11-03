import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, startHub, type TestHub } from '../support/hub.js';

const TOKEN = 'token-de-prueba-suficientemente-largo-123456';
const json = { 'content-type': 'application/json' };

const send = (hub: TestHub, method: string, path: string, payload?: unknown) =>
  fetch(`${hub.url}${path}`, { method, headers: json, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
const importBackup = (hub: TestHub, backup: unknown, onConflict?: string) => send(hub, 'POST', '/api/backup/import', { backup, ...(onConflict ? { onConflict } : {}) });
const list = async (hub: TestHub) => body(await send(hub, 'GET', '/api/diagrams'));

/** Crea un proyecto con un diagrama adentro y otro suelto; devuelve sus ids. */
async function seed(hub: TestHub) {
  const project = await body(await send(hub, 'POST', '/api/projects', { name: 'Tienda' }));
  const first = await body(await send(hub, 'POST', '/api/diagrams', { type: 'class', title: 'Pedidos', projectId: project.id }));
  const second = await body(await send(hub, 'POST', '/api/diagrams', { type: 'class', title: 'Clientes' }));
  return { projectId: project.id as string, withProject: first.diagramId as string, loose: second.diagramId as string };
}

describe('API REST /api/backup', () => {
  let origen: TestHub;
  let destino: TestHub;
  let ids: Awaited<ReturnType<typeof seed>>;
  beforeAll(async () => {
    origen = await startHub();
    destino = await startHub();
    ids = await seed(origen);
  });
  afterAll(async () => {
    await origen.close();
    await destino.close();
  });

  it('GET exporta todos los diagramas y proyectos como archivo JSON descargable', async () => {
    const res = await send(origen, 'GET', '/api/backup');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="chartsia-respaldo-\d{4}-\d{2}-\d{2}\.json"$/);
    const backup = await body(res);
    expect(backup).toMatchObject({ format: 'chartsia-backup', version: 1 });
    expect(backup.projects).toEqual([expect.objectContaining({ id: ids.projectId, name: 'Tienda' })]);
    expect(backup.diagrams.map((d: { diagram: { id: string } }) => d.diagram.id).sort()).toEqual([ids.withProject, ids.loose].sort());
    expect(backup.diagrams.find((d: { diagram: { id: string } }) => d.diagram.id === ids.withProject).projectId).toBe(ids.projectId);
    expect(backup.diagrams.find((d: { diagram: { id: string } }) => d.diagram.id === ids.loose).projectId).toBeUndefined();
  });

  it('POST /import restaura diagramas y proyectos en un hub vacío', async () => {
    const backup = await body(await send(origen, 'GET', '/api/backup'));
    const res = await importBackup(destino, backup);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ imported: 2, replaced: 0, skipped: 0, projectsCreated: 1 });
    const after = await list(destino);
    expect(after.projects.map((p: { name: string }) => p.name)).toEqual(['Tienda']);
    expect(after.diagrams).toHaveLength(2);
    expect(after.diagrams.find((d: { diagramId: string }) => d.diagramId === ids.withProject).projectId).toBe(ids.projectId);
    expect((await send(destino, 'GET', `/api/diagrams/${ids.loose}`)).status).toBe(200);
  });

  it('con un id repetido responde 409 y no escribe nada hasta que se elija qué hacer', async () => {
    const backup = await body(await send(origen, 'GET', '/api/backup'));
    await send(destino, 'POST', `/api/diagrams/${ids.loose}/operations`, { operations: [{ op: 'set_title', title: 'Cambiado aquí' }] });
    const nuevo = (await body(await send(origen, 'POST', '/api/diagrams', { type: 'class', title: 'Extra' }))).diagramId;
    const conNuevo = await body(await send(origen, 'GET', '/api/backup'));
    expect(conNuevo.diagrams).toHaveLength(3);

    const res = await importBackup(destino, conNuevo);
    expect(res.status).toBe(409);
    const errors = (await body(res)).errors;
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({ code: 'IMPORT_CONFLICT', message: expect.stringContaining('ya existe') });
    expect((await list(destino)).diagrams).toHaveLength(2);
    expect(backup.diagrams).toHaveLength(2);

    // Saltar: lo existente queda como está y solo entra el diagrama nuevo.
    const skip = await importBackup(destino, conNuevo, 'skip');
    expect(await body(skip)).toEqual({ imported: 1, replaced: 0, skipped: 2, projectsCreated: 0 });
    expect((await list(destino)).diagrams.find((d: { diagramId: string }) => d.diagramId === ids.loose).title).toBe('Cambiado aquí');
    expect((await send(destino, 'GET', `/api/diagrams/${nuevo}`)).status).toBe(200);
  });

  it('con onConflict replace reemplaza el diagrama existente y sube su revisión', async () => {
    const backup = await body(await send(origen, 'GET', '/api/backup'));
    const antes = await body(await send(destino, 'GET', `/api/diagrams/${ids.loose}`));
    const res = await importBackup(destino, backup, 'replace');
    expect(await body(res)).toEqual({ imported: 0, replaced: 3, skipped: 0, projectsCreated: 0 });
    const despues = await body(await send(destino, 'GET', `/api/diagrams/${ids.loose}`));
    expect(despues.title).toBe('Clientes');
    expect(despues.revision).toBeGreaterThan(antes.revision);
  });

  it('un archivo inválido responde 422 y no cambia nada', async () => {
    const backup = await body(await send(origen, 'GET', '/api/backup'));
    const antes = (await list(destino)).diagrams.length;
    const malos: unknown[] = [
      'no es un respaldo',
      { format: 'otro', version: 1 },
      { ...backup, version: 2 },
      { ...backup, diagrams: [...backup.diagrams, { diagram: { id: 'dg_zzzzzzzzzzzz', type: 'class', title: 'Roto' } }] },
      { ...backup, diagrams: [backup.diagrams[0], backup.diagrams[0]] },
      { ...backup, diagrams: [{ projectId: 'pr_inexistente', diagram: backup.diagrams[0].diagram }] },
    ];
    for (const malo of malos) {
      const res = await importBackup(destino, malo, 'replace');
      expect(res.status, JSON.stringify(malo).slice(0, 80)).toBe(422);
      expect((await body(res)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: expect.stringMatching(/^\/backup/) });
    }
    expect((await send(destino, 'POST', '/api/backup/import', { backup, onConflict: 'borrar' })).status).toBe(422);
    expect((await list(destino)).diagrams).toHaveLength(antes);
  });
});

describe('auth de /api/backup fuera de loopback', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_TOKEN: TOKEN });
  });
  afterAll(() => hub.close());

  it('exige el token para exportar e importar', async () => {
    expect((await fetch(`${hub.url}/api/backup`)).status).toBe(401);
    expect((await fetch(`${hub.url}/api/backup/import`, { method: 'POST', headers: json, body: '{}' })).status).toBe(401);
    expect((await fetch(`${hub.url}/api/backup`, { headers: { authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
  });
});
