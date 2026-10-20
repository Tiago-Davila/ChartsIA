import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config/config.js';
import { DiagramCommandService } from '../../src/diagrams/diagram-command.service.js';
import { DiagramEvents } from '../../src/diagrams/diagram-events.js';
import { DiagramQueryService } from '../../src/diagrams/diagram-query.service.js';
import { DiagramLock } from '../../src/diagrams/persistence/diagram-lock.js';
import { JsonFileDiagramRepository } from '../../src/diagrams/persistence/json-file.repository.js';
import { libraryInput } from '../support/services.js';

describe('varios diagramas en disco', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'chartsia-varios-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function open() {
    const repo = new JsonFileDiagramRepository(dir, { warn: vi.fn() });
    await repo.init();
    const query = new DiagramQueryService(repo);
    const commands = new DiagramCommandService(repo, new DiagramLock(), new DiagramEvents(), query, loadConfig({}));
    return { query, commands };
  }

  it('crear dos diagramas conserva ambos, los lista y se pueden abrir, también tras reiniciar', async () => {
    const first = await open();
    const a = (await first.commands.create(libraryInput)).diagram;
    const b = (await first.commands.create({ ...libraryInput, title: 'Sucursales' })).diagram;
    expect(a.id).not.toBe(b.id);

    const { query } = await open();
    const list = await query.list();
    expect(list.diagrams.map((d) => d.diagramId).sort()).toEqual([a.id, b.id].sort());
    expect(list.activeDiagramId).toBe(b.id);
    expect((await query.get(a.id)).title).toBe('Biblioteca');
    expect((await query.get(b.id)).title).toBe('Sucursales');
    expect(JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')).diagrams).toHaveLength(2);
  });
});
