import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonFileDiagramRepository } from '../../src/diagrams/persistence/json-file.repository.js';
import { storedDiagram } from '../support/diagrams.js';

const proyecto = { id: 'pr_abcdefghijkl', name: 'Tienda', createdAt: '2026-01-01T00:00:00.000Z' };

describe('proyectos en disco', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'chartsia-proy-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function open() {
    const repo = new JsonFileDiagramRepository(dir, { warn: vi.fn() });
    await repo.init();
    return repo;
  }

  it('los proyectos y la asignación sobreviven a reabrir, también tras guardar el diagrama', async () => {
    const d = storedDiagram();
    const repo = await open();
    await repo.save(d);
    await repo.saveProject(proyecto);
    await repo.setDiagramProject(d.id, proyecto.id);
    await repo.save({ ...d, revision: d.revision + 1 });

    const again = await open();
    expect(await again.listProjects()).toEqual([proyecto]);
    expect((await again.list())[0]?.projectId).toBe(proyecto.id);
  });

  it('borrar el proyecto deja los diagramas sin proyecto', async () => {
    const d = storedDiagram();
    const repo = await open();
    await repo.save(d);
    await repo.saveProject(proyecto);
    await repo.setDiagramProject(d.id, proyecto.id);
    await repo.deleteProject(proyecto.id);

    const again = await open();
    expect(await again.listProjects()).toEqual([]);
    expect((await again.list())[0]?.projectId).toBeUndefined();
  });

  it('un index.json viejo sin proyectos sigue cargando', async () => {
    const d = storedDiagram();
    const repo = await open();
    await repo.save(d);
    const old = { version: 1, activeDiagramId: d.id, diagrams: await repo.list() };
    await writeFile(join(dir, 'index.json'), JSON.stringify(old));

    const again = await open();
    expect(await again.listProjects()).toEqual([]);
    expect(await again.list()).toHaveLength(1);
    expect(await again.getActiveId()).toBe(d.id);
  });

  it('rechaza ids de proyecto inválidos y asignaciones a proyectos inexistentes', async () => {
    const d = storedDiagram();
    const repo = await open();
    await repo.save(d);
    await expect(repo.saveProject({ ...proyecto, id: '../etc' })).rejects.toThrow();
    await expect(repo.setDiagramProject(d.id, proyecto.id)).rejects.toThrow();
  });
});
