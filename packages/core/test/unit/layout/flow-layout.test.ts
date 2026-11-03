import { describe, expect, it } from 'vitest';
import { layoutDiagram, relayoutDiagram } from '../../../src/layout/index.js';
import { type Diagram, type Element } from '../../../src/model/index.js';
import { edgesCrossingNodes, layoutOf, overlappingPairs } from '../../support/geometry.js';

const node = (id: string, variant: 'trigger' | 'component' | 'database' | 'queue', extra: Partial<Element> = {}): Element => ({ id, kind: 'flow-node', variant, name: id, ...extra }) as Element;

const diagram: Diagram = {
  id: 'dg_aaaaaaaaaaaa',
  type: 'flow',
  title: 'Flujo',
  revision: 1,
  createdAt: 'x',
  updatedAt: 'x',
  elements: [node('entrada', 'trigger'), node('servicio', 'component'), node('datos', 'database'), node('cola', 'queue')],
  relations: [
    { id: 'r1', kind: 'flow-edge', source: 'entrada', target: 'servicio' },
    { id: 'r2', kind: 'flow-edge', source: 'servicio', target: 'datos', flowType: 'write' },
    { id: 'r3', kind: 'flow-edge', source: 'servicio', target: 'cola', flowType: 'event' },
  ],
};

describe('layout de flujos', () => {
  it('va de izquierda a derecha aunque las preferencias pidan hacia abajo', async () => {
    const result = await layoutDiagram({ ...diagram, preferences: undefined });
    const x = (id: string) => layoutOf(result, id).x;
    expect(x('entrada')).toBeLessThan(x('servicio'));
    expect(x('servicio')).toBeLessThan(x('datos'));
    expect(x('servicio')).toBeLessThan(x('cola'));
  });

  it('es determinista, sin solapes y sin cruzar nodos', async () => {
    const result = await layoutDiagram(diagram);
    expect(JSON.stringify(await layoutDiagram(diagram))).toBe(JSON.stringify(result));
    expect(overlappingPairs(result)).toEqual([]);
    expect(edgesCrossingNodes(result)).toEqual([]);
  });

  it('conecta la salida derecha del origen con la entrada izquierda del destino', async () => {
    const result = await layoutDiagram(diagram);
    for (const rel of result.relations) {
      const route = rel.route!;
      const source = layoutOf(result, rel.source);
      const target = layoutOf(result, rel.target);
      expect(route[0]).toEqual({ x: source.x + source.width!, y: source.y + source.height! / 2 });
      expect(route[route.length - 1]).toEqual({ x: target.x, y: target.y + target.height! / 2 });
    }
  });

  it('une un nodo con un frame y respeta lo ya colocado en el layout incremental', async () => {
    const withFrame: Diagram = {
      ...diagram,
      elements: [...diagram.elements.map((el) => (el.id === 'datos' ? { ...el, parentId: 'capa' } : el)), { id: 'capa', kind: 'frame', name: 'Capa de datos' }],
      relations: [...diagram.relations, { id: 'r4', kind: 'flow-edge', source: 'cola', target: 'capa' }],
    };
    const first = await layoutDiagram(withFrame);
    expect(first.relations.find((r) => r.id === 'r4')?.route?.length).toBeGreaterThanOrEqual(2);
    const next = { ...first, elements: [...first.elements, node('extra', 'component')] };
    const { diagram: again } = await relayoutDiagram(first, next);
    for (const el of first.elements) expect(layoutOf(again, el.id)).toMatchObject({ x: el.layout!.x, y: el.layout!.y });
  });
});
