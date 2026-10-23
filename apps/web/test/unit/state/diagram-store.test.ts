import { type Diagram } from '@chartsia/core/model';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDiagramStore } from '../../../src/state/diagram-store';

const d = (revision: number, title = 'T', id = 'dg_aaaaaaaaaaaa'): Diagram => ({
  id, type: 'class', title, revision, createdAt: '', updatedAt: `2026-10-20T10:00:0${revision}.000Z`, elements: [], relations: [],
});

describe('diagram store', () => {
  let store: ReturnType<typeof createDiagramStore>;
  beforeEach(() => {
    store = createDiagramStore();
    store.getState().open('dg_aaaaaaaaaaaa');
    store.getState().receiveDiagram(d(2));
  });

  it('aplica diagram.updated solo si la revision es mayor', () => {
    store.getState().applyUpdate({ diagramId: 'dg_aaaaaaaaaaaa', revision: 3, origin: 'agent', diagram: d(3, 'nuevo') });
    expect(store.getState().diagram?.title).toBe('nuevo');
    store.getState().applyUpdate({ diagramId: 'dg_aaaaaaaaaaaa', revision: 3, origin: 'app', diagram: d(3, 'repetido') });
    store.getState().applyUpdate({ diagramId: 'dg_aaaaaaaaaaaa', revision: 1, origin: 'app', diagram: d(1, 'viejo') });
    expect(store.getState().diagram?.title).toBe('nuevo');
    expect(store.getState().lastOrigin).toBe('agent');
  });

  it('guarda los elementos nuevos o modificados del último diagram.updated', () => {
    const el = (id: string, name: string) => ({ id, kind: 'class' as const, name, attributes: [], operations: [] });
    const con = (revision: number, elements: ReturnType<typeof el>[]) => ({ ...d(revision, 't'), elements });
    store.getState().receiveDiagram(con(2, [el('A', 'A'), el('B', 'B')]));
    store.getState().applyUpdate({ diagramId: 'dg_aaaaaaaaaaaa', revision: 3, origin: 'agent', diagram: con(3, [el('A', 'A'), el('B', 'B2'), el('C', 'C')]) });
    expect(store.getState().lastChangedIds).toEqual(['B', 'C']);
    store.getState().clearChangedIds();
    expect(store.getState().lastChangedIds).toEqual([]);
    store.getState().applyUpdate({ diagramId: 'dg_aaaaaaaaaaaa', revision: 4, origin: 'app', diagram: con(4, [el('A', 'A9'), el('B', 'B2'), el('C', 'C')]) });
    expect(store.getState().lastChangedIds).toEqual([]);
  });

  it('ignora actualizaciones de otro diagrama pero actualiza su resumen en la lista', () => {
    store.getState().setList({ activeDiagramId: null, projects: [], diagrams: [{ diagramId: 'dg_bbbbbbbbbbbb', type: 'class', title: 'B', revision: 1, updatedAt: '' }] });
    store.getState().applyUpdate({ diagramId: 'dg_bbbbbbbbbbbb', revision: 5, origin: 'agent', diagram: d(5, 'B2', 'dg_bbbbbbbbbbbb') });
    expect(store.getState().diagram?.id).toBe('dg_aaaaaaaaaaaa');
    expect(store.getState().diagrams[0]).toMatchObject({ title: 'B2', revision: 5 });
  });

  it('reconciliación al reconectar: reemplaza solo si la revision remota es mayor', () => {
    store.getState().reconcile(d(1, 'remoto viejo'));
    expect(store.getState().diagram?.revision).toBe(2);
    store.getState().reconcile(d(7, 'remoto nuevo'));
    expect(store.getState().diagram).toMatchObject({ revision: 7, title: 'remoto nuevo' });
  });

  it('abrir otro diagrama descarta el actual hasta recibirlo', () => {
    store.getState().open('dg_bbbbbbbbbbbb');
    expect(store.getState().diagram).toBeUndefined();
    store.getState().receiveDiagram(d(9, 'A tarde'));
    expect(store.getState().diagram).toBeUndefined();
  });

  it('diagram.created añade el resumen y active.changed fija el activo', () => {
    store.getState().diagramCreated({ diagramId: 'dg_cccccccccccc', title: 'C', type: 'class' });
    expect(store.getState().diagrams.map((x) => x.diagramId)).toContain('dg_cccccccccccc');
    store.getState().setActive('dg_cccccccccccc');
    expect(store.getState().activeDiagramId).toBe('dg_cccccccccccc');
  });

  it('diagramDeleted quita el resumen y, si estaba abierto o activo, lo desmarca', () => {
    store.getState().setList({
      activeDiagramId: 'dg_aaaaaaaaaaaa',
      diagrams: [
        { diagramId: 'dg_aaaaaaaaaaaa', type: 'class', title: 'T', revision: 2, updatedAt: '2026-10-20T10:00:00.000Z' },
        { diagramId: 'dg_bbbbbbbbbbbb', type: 'class', title: 'U', revision: 1, updatedAt: '2026-10-19T10:00:00.000Z' },
      ],
      projects: [],
    });
    store.getState().diagramDeleted('dg_aaaaaaaaaaaa');
    const estado = store.getState();
    expect(estado.diagrams.map((d) => d.diagramId)).toEqual(['dg_bbbbbbbbbbbb']);
    expect(estado.openDiagramId).toBeNull();
    expect(estado.diagram).toBeUndefined();
    expect(estado.activeDiagramId).toBeNull();
  });

  it('diagramDeleted de otro diagrama no toca el abierto ni el activo', () => {
    store.getState().diagramDeleted('dg_bbbbbbbbbbbb');
    expect(store.getState().openDiagramId).toBe('dg_aaaaaaaaaaaa');
    expect(store.getState().diagram?.id).toBe('dg_aaaaaaaaaaaa');
  });

  it('errores de validación y revertir la vista', () => {
    const before = store.getState().viewVersion;
    store.getState().showErrors([{ code: 'UNKNOWN_REFERENCE', path: '/operations/0/id', message: 'm', hint: 'h' }]);
    expect(store.getState().errors).toHaveLength(1);
    expect(store.getState().viewVersion).toBe(before + 1);
    store.getState().dismissErrors();
    expect(store.getState().errors).toEqual([]);
  });
});
