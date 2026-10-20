import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonFileDiagramRepository } from '../../src/diagrams/persistence/json-file.repository.js';
import { storedDiagram } from '../support/diagrams.js';

describe('JsonFileDiagramRepository', () => {
  let dir: string;
  const quiet = { warn: vi.fn() };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'chartsia-repo-'));
    quiet.warn.mockReset();
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function open(sub = '') {
    const repo = new JsonFileDiagramRepository(join(dir, sub), quiet);
    await repo.init();
    return repo;
  }

  it('crea el directorio, guarda, lee y lista', async () => {
    const repo = await open('nested/data');
    const d = storedDiagram();
    await repo.save(d);
    expect(await repo.get(d.id)).toEqual(d);
    expect(await repo.list()).toEqual([
      { diagramId: d.id, type: d.type, title: d.title, revision: d.revision, updatedAt: d.updatedAt },
    ]);
    expect(await repo.get('dg_zzzzzzzzzzzz')).toBeUndefined();
  });

  it('persiste entre instancias (sobrevive reinicios), incluido el activo', async () => {
    const d = storedDiagram();
    const repo = await open();
    await repo.save(d);
    await repo.setActiveId(d.id);
    const again = await open();
    expect(await again.get(d.id)).toEqual(d);
    expect(await again.getActiveId()).toBe(d.id);
  });

  it('carga diagramas guardados con el campo style ya retirado', async () => {
    const d = storedDiagram();
    await (await open()).save(d);
    await writeFile(join(dir, `${d.id}.json`), JSON.stringify({ ...d, style: 'sketch' }));
    expect(await (await open()).get(d.id)).toEqual(d);
  });

  it('lista ordenado por updatedAt descendente', async () => {
    const repo = await open();
    const old = storedDiagram({ updatedAt: '2026-01-01T00:00:00.000Z' });
    const recent = storedDiagram({ updatedAt: '2026-06-01T00:00:00.000Z' });
    await repo.save(old);
    await repo.save(recent);
    expect((await repo.list()).map((s) => s.diagramId)).toEqual([recent.id, old.id]);
  });

  it('escritura atómica: si falla el rename no corrompe el archivo ni deja temporales', async () => {
    const repo = await open();
    const d = storedDiagram();
    await repo.save(d);
    const failing = new JsonFileDiagramRepository(dir, quiet, {
      rename: () => Promise.reject(new Error('disco lleno')),
    });
    await failing.init();
    await expect(failing.save({ ...d, title: 'Nuevo', revision: 2 })).rejects.toThrow('disco lleno');
    expect(JSON.parse(await readFile(join(dir, `${d.id}.json`), 'utf8'))).toEqual(d);
    expect((await readdir(dir)).filter((f) => f.includes('.tmp'))).toEqual([]);
  });

  it.each([
    ['falta', async () => rm(join(dir, 'index.json'))],
    ['está corrupto', async () => writeFile(join(dir, 'index.json'), '{ no json')],
  ])('reconstruye index.json si %s y el activo pasa a ser el más reciente', async (_c, damage) => {
    const repo = await open();
    const old = storedDiagram({ updatedAt: '2026-01-01T00:00:00.000Z' });
    const recent = storedDiagram({ updatedAt: '2026-06-01T00:00:00.000Z' });
    await repo.save(old);
    await repo.save(recent);
    await repo.setActiveId(old.id);
    await damage();
    const rebuilt = await open();
    expect((await rebuilt.list()).map((s) => s.diagramId)).toEqual([recent.id, old.id]);
    expect(await rebuilt.getActiveId()).toBe(recent.id);
    const index = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'));
    expect(index.activeDiagramId).toBe(recent.id);
  });

  it('ignora y registra archivos de diagrama inválidos', async () => {
    const repo = await open();
    const d = storedDiagram();
    await repo.save(d);
    await writeFile(join(dir, 'dg_bbbbbbbbbbbb.json'), JSON.stringify({ id: 'dg_bbbbbbbbbbbb', basura: true }));
    await rm(join(dir, 'index.json'));
    const rebuilt = await open();
    expect((await rebuilt.list()).map((s) => s.diagramId)).toEqual([d.id]);
    expect(await rebuilt.get('dg_bbbbbbbbbbbb')).toBeUndefined();
    expect(quiet.warn).toHaveBeenCalled();
  });

  it('rechaza ids que no son de diagrama (sin acceso a rutas arbitrarias)', async () => {
    const repo = await open();
    expect(await repo.get('../../etc/passwd')).toBeUndefined();
    await expect(repo.setActiveId('../x')).rejects.toThrow();
  });

  it('getActiveId devuelve null sin diagramas', async () => {
    const repo = await open();
    expect(await repo.getActiveId()).toBeNull();
  });
});
