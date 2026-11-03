import { describe, expect, it } from 'vitest';
import { type Backup } from '../../src/diagrams/backup.js';
import { createServices, libraryInput } from '../support/services.js';

describe('importBackup es todo o nada', () => {
  it('si falla a mitad de la escritura deja los diagramas y proyectos como estaban', async () => {
    const { commands, query, repo } = createServices();
    const existente = (await commands.create(libraryInput)).diagram;
    const otro = (await commands.create({ ...libraryInput, title: 'Otro' })).diagram;
    const antes = await query.backup();

    const backup: Backup = {
      format: 'chartsia-backup',
      version: 1,
      exportedAt: '2026-11-03T00:00:00.000Z',
      projects: [{ id: 'pr_aaaaaaaaaaaa', name: 'Nuevo', createdAt: '2026-11-03T00:00:00.000Z' }],
      diagrams: [
        { projectId: 'pr_aaaaaaaaaaaa', diagram: { ...existente, title: 'Reemplazado' } },
        { diagram: { ...otro, id: 'dg_bbbbbbbbbbbb', title: 'Nuevo 1' } },
        { diagram: { ...otro, id: 'dg_cccccccccccc', title: 'Nuevo 2' } },
      ],
    };
    // El tercer guardado falla, como un disco lleno.
    const save = repo.save.bind(repo);
    let saves = 0;
    repo.save = async (diagram) => {
      if (++saves === 3) throw new Error('disco lleno');
      return save(diagram);
    };

    await expect(commands.importBackup(backup, 'replace')).rejects.toThrow('disco lleno');
    repo.save = save;
    const despues = await query.backup();
    expect({ ...despues, exportedAt: '' }).toEqual({ ...antes, exportedAt: '' });
    expect(await repo.listProjects()).toEqual([]);
  });
});
