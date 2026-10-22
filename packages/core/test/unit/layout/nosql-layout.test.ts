import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '../../../src/layout/index.js';
import { type Diagram } from '../../../src/model/index.js';
import { edgesCrossingNodes, overlappingPairs } from '../../support/geometry.js';

const diagram: Diagram = {
  id: 'dg_aaaaaaaaaaaa',
  type: 'nosql',
  title: 'Pedidos',
  revision: 1,
  createdAt: 'x',
  updatedAt: 'x',
  elements: [
    { id: 'Pedidos', kind: 'collection', name: 'pedidos', fields: [{ path: ['cliente'], type: 'object' }, { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' }, { path: ['cliente', 'direcciones', 'calle'], type: 'string' }] },
    { id: 'Clientes', kind: 'collection', name: 'clientes', fields: [{ path: ['nombre'], type: 'string' }] },
  ],
  relations: [{ id: 'r1', kind: 'nosql-rel', source: 'Pedidos', target: 'Clientes', label: 'clienteId' }],
};

describe('layout NoSQL', () => {
  it('dispone colecciones anidadas sin solapes y enruta referencias entre ellas', async () => {
    const result = await layoutDiagram(diagram);
    expect(JSON.stringify(await layoutDiagram(diagram))).toBe(JSON.stringify(result));
    expect(overlappingPairs(result)).toEqual([]);
    expect(edgesCrossingNodes(result)).toEqual([]);
    expect(result.elements.every((element) => (element.layout?.width ?? 0) > 0 && (element.layout?.height ?? 0) > 0)).toBe(true);
    expect(result.relations[0]?.route?.length).toBeGreaterThanOrEqual(2);
  });
});
