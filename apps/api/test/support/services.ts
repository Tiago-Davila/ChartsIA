import { loadConfig } from '../../src/config/config.js';
import { DiagramCommandService } from '../../src/diagrams/diagram-command.service.js';
import { DiagramEvents, type DiagramEvent } from '../../src/diagrams/diagram-events.js';
import { DiagramQueryService } from '../../src/diagrams/diagram-query.service.js';
import { DiagramLock } from '../../src/diagrams/persistence/diagram-lock.js';
import { InMemoryDiagramRepository } from '../../src/diagrams/persistence/in-memory.repository.js';

/** Servicios de aplicación cableados a mano con repositorio en memoria y reloj fijo. */
export function createServices(overrides: { maxElements?: number } = {}) {
  const config = { ...loadConfig({}), ...overrides };
  const repo = new InMemoryDiagramRepository();
  const events = new DiagramEvents();
  const emitted: DiagramEvent[] = [];
  events.subscribe((e) => emitted.push(e));
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 20, 10, 0, tick++));
  let seq = 0;
  const ids = () => `dg_${'abcdefghijklmnopqrstuvwxyz'[seq++ % 26]!.repeat(12)}`;
  const query = new DiagramQueryService(repo);
  const commands = new DiagramCommandService(repo, new DiagramLock(), events, query, config, clock, ids);
  return { config, repo, events, emitted, query, commands };
}

export const libraryInput = {
  type: 'class',
  title: 'Biblioteca',
  elements: [
    { id: 'Libro', kind: 'class', name: 'Libro', attributes: [{ name: 'isbn', type: 'String', visibility: '-' }], operations: [] },
    { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [] },
  ],
  relations: [{ id: 'r1', kind: 'association', source: 'Libro', target: 'Autor' }],
};
