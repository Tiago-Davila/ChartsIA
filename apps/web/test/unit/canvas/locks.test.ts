import { type Diagram, type Operation } from '@chartsia/core/model';
import { describe, expect, it } from 'vitest';
import { frozenIds, unlockedOperations } from '../../../src/canvas/locks';
import { toReactFlow } from '../../../src/canvas/to-react-flow';

// Marco F con un bloqueado dentro (A) y una clase libre (B).
const diagram = {
  id: 'dg_aaaaaaaaaaaa',
  type: 'class',
  title: 'Bloqueos',
  revision: 1,
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
  elements: [
    { id: 'F', kind: 'frame', name: 'F' },
    { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [], parentId: 'F', locked: true },
    { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
  ],
  relations: [],
} as unknown as Diagram;

describe('bloqueos en la app', () => {
  it('frozenIds incluye el bloqueado y los grupos que lo contienen', () => {
    expect([...frozenIds(diagram)].sort()).toEqual(['A', 'F']);
  });

  it('descarta lo que moveria, redimensionaria, borraria o editaria un bloqueado', () => {
    const ops: Operation[] = [
      { op: 'move_element', id: 'A', x: 1, y: 1 },
      { op: 'resize_element', id: 'A', width: 100, height: 100 },
      { op: 'remove_element', id: 'A' },
      { op: 'update_element', id: 'A', changes: { name: 'Nuevo' } },
      { op: 'move_element', id: 'F', x: 1, y: 1 },
      { op: 'remove_element', id: 'F', cascade: 'children' },
    ];
    expect(unlockedOperations(diagram, ops)).toEqual([]);
  });

  it('deja pasar el desbloqueo, lo libre y las relaciones', () => {
    const ops: Operation[] = [
      { op: 'update_element', id: 'A', changes: { locked: false } },
      { op: 'move_element', id: 'B', x: 1, y: 1 },
      { op: 'update_element', id: 'B', changes: { name: 'C' } },
      { op: 'add_relation', relation: { id: 'r', kind: 'association', source: 'A', target: 'B' } },
    ];
    expect(unlockedOperations(diagram, ops)).toEqual(ops);
  });

  it('toReactFlow no permite arrastrar ni borrar el bloqueado ni su grupo', () => {
    const { nodes } = toReactFlow(diagram);
    const flags = Object.fromEntries(nodes.map((n) => [n.id, { draggable: n.draggable, deletable: n.deletable }]));
    expect(flags).toEqual({
      F: { draggable: false, deletable: false },
      A: { draggable: false, deletable: false },
      B: { draggable: true, deletable: true },
    });
  });
});
