import { type Diagram } from '@chartsia/core/model';
import { describe, expect, it } from 'vitest';
import { toReactFlow } from '../../../src/canvas/to-react-flow';
import { nodeTypes } from '../../../src/nodes';
import { edgeTypes } from '../../../src/edges';

const diagram: Diagram = {
  id: 'dg_aaaaaaaaaaaa',
  type: 'c4-container',
  title: 'Tienda',
  revision: 4,
  createdAt: '',
  updatedAt: '',
  elements: [
    { id: 'web', kind: 'container', name: 'Web', parentId: 'tienda', layout: { x: 130, y: 220, width: 220, height: 110, pinned: false } },
    { id: 'cliente', kind: 'person', name: 'Cliente', layout: { x: 100, y: 20, width: 220, height: 150, pinned: true } },
    { id: 'tienda', kind: 'boundary', name: 'Tienda', boundaryType: 'system', layout: { x: 100, y: 180, width: 300, height: 200, pinned: false } },
  ],
  relations: [{ id: 'u1', kind: 'c4-rel', source: 'cliente', target: 'web', route: [{ x: 210, y: 170 }, { x: 210, y: 220 }] }],
};

describe('toReactFlow', () => {
  const { nodes, edges } = toReactFlow(diagram);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  it('layout → position/width/height', () => {
    expect(byId.cliente).toMatchObject({ position: { x: 100, y: 20 }, width: 220, height: 150, type: 'person' });
  });

  it('grupos antes que sus hijos; hijos con parentId y posición relativa', () => {
    expect(nodes.findIndex((n) => n.id === 'tienda')).toBeLessThan(nodes.findIndex((n) => n.id === 'web'));
    expect(byId.web).toMatchObject({ parentId: 'tienda', position: { x: 30, y: 40 } });
    expect(byId.tienda).not.toHaveProperty('parentId');
  });

  it('el tipo de nodo es el kind y existe en nodeTypes', () => {
    for (const n of nodes) expect(nodeTypes).toHaveProperty(n.type!);
    for (const e of edges) expect(edgeTypes).toHaveProperty(e.type!);
  });

  it('datos: elemento; handles declarados', () => {
    expect(byId.web!.data).toEqual({ element: diagram.elements[0] });
    expect(byId.web!.handles).toHaveLength(2);
  });

  it('route → data de la arista', () => {
    expect(edges).toEqual([
      expect.objectContaining({ id: 'u1', source: 'cliente', target: 'web', type: 'routed', data: { relation: diagram.relations[0] } }),
    ]);
  });

  it('ignora relaciones con extremos inexistentes', () => {
    const broken = toReactFlow({ ...diagram, relations: [{ id: 'x', kind: 'c4-rel', source: 'nadie', target: 'web' }] });
    expect(broken.edges).toEqual([]);
  });
});
