import { describe, expect, it } from 'vitest';
import { type Diagram, ELEMENT_VARIANTS, FLOW_VARIANTS } from '../../../src/model/index.js';
import { applyOperations } from '../../../src/operations/index.js';

const base = (): Diagram => ({
  id: 'dg_aaaaaaaaaaaa',
  type: 'flow',
  title: 'Flujo',
  revision: 1,
  createdAt: 'x',
  updatedAt: 'x',
  elements: [
    { id: 'A', kind: 'flow-node', variant: 'method', name: 'A' },
    { id: 'B', kind: 'flow-node', variant: 'database', name: 'B' },
  ],
  relations: [{ id: 'r1', kind: 'flow-edge', source: 'A', target: 'B' }],
});

describe('operaciones sobre flujos', () => {
  it('agrega nodos y conexiones de flujo en un solo lote', () => {
    const res = applyOperations(base(), [
      { op: 'add_element', element: { id: 'C', kind: 'flow-node', variant: 'queue', name: 'C', subtitle: 'tópico' } },
      { op: 'add_relation', relation: { id: 'r2', kind: 'flow-edge', source: 'A', target: 'C', flowType: 'event' } },
    ]);
    expect(res.ok).toBe(true);
  });

  it('cambia variante y subtítulo, y quita el subtítulo con null', () => {
    const res = applyOperations(base(), [
      { op: 'update_element', id: 'A', changes: { variant: 'file', subtitle: 'src/a.ts' } },
      { op: 'update_element', id: 'A', changes: { subtitle: null } },
    ]);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'A')).toMatchObject({ variant: 'file' });
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'A')).not.toHaveProperty('subtitle');
  });

  it('rechaza una variante de nodo que no existe y la de contenedor "web"', () => {
    for (const variant of ['robot', 'web']) {
      const res = applyOperations(base(), [{ op: 'update_element', id: 'A', changes: { variant } }]);
      expect(res.ok).toBe(false);
    }
  });

  it('cambia el tipo de una conexión y la vuelve a call con null', () => {
    const res = applyOperations(base(), [{ op: 'update_relation', id: 'r1', changes: { flowType: 'write' } }]);
    expect(res.ok && res.diagram.relations[0]).toMatchObject({ flowType: 'write' });
    const back = applyOperations(base(), [{ op: 'update_relation', id: 'r1', changes: { flowType: 'write' } }, { op: 'update_relation', id: 'r1', changes: { flowType: null } }]);
    expect(back.ok && back.diagram.relations[0]).not.toHaveProperty('flowType');
  });

  it('las variantes admitidas no se repiten y cubren las de flujo', () => {
    expect(new Set(ELEMENT_VARIANTS).size).toBe(ELEMENT_VARIANTS.length);
    for (const variant of FLOW_VARIANTS) expect(ELEMENT_VARIANTS).toContain(variant);
  });
});
