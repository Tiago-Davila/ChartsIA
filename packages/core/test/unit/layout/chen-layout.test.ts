import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '../../../src/layout/index.js';
import type { Diagram } from '../../../src/model/index.js';
import { edgesCrossingNodes, layoutOf, overlappingPairs } from '../../support/geometry.js';

describe('layout de atributos Chen', () => {
  it('dispone óvalos y listas sin solapes y es determinista', async () => {
    const raw = JSON.parse(readFileSync(new URL('../../golden/fixtures/shop-er-chen.json', import.meta.url), 'utf8'));
    const diagram = { ...raw, id: 'dg_aaaaaaaaaaaa', revision: 1, createdAt: 'x', updatedAt: 'x' } as Diagram;
    const a = await layoutDiagram(diagram);
    expect(JSON.stringify(await layoutDiagram(diagram))).toBe(JSON.stringify(a));
    expect(overlappingPairs(a)).toEqual([]);
    expect(edgesCrossingNodes(a)).toEqual([]);
    expect(a.relations.every((r) => (r.route?.length ?? 0) >= 2)).toBe(true);
  });

  it('la er-attr termina sobre el borde del óvalo, no en el de su caja', async () => {
    const diagram = {
      id: 'dg_aaaaaaaaaaaa', revision: 1, createdAt: 'x', updatedAt: 'x', type: 'er', title: 'T',
      elements: [
        { id: 'E', kind: 'entity', name: 'E', layout: { x: 0, y: 0 } },
        { id: 'a', kind: 'attribute', name: 'a', layout: { x: 0, y: 200 } },
        { id: 'b', kind: 'attribute', name: 'b', layout: { x: 100, y: 200 } },
      ],
      relations: [
        { id: 'r1', kind: 'er-attr', source: 'E', target: 'a' },
        { id: 'r2', kind: 'er-attr', source: 'E', target: 'b' },
      ],
    } as unknown as Diagram;
    const laid = await layoutDiagram(diagram);
    for (const [rel, id] of [['r1', 'a'], ['r2', 'b']] as const) {
      const route = laid.relations.find((r) => r.id === rel)!.route!;
      const end = route[route.length - 1]!;
      const box = layoutOf(laid, id);
      const rx = box.width / 2;
      const ry = box.height / 2;
      // El punto final cumple la ecuación del óvalo inscrito en la caja.
      const k = ((end.x - box.x - rx) / rx) ** 2 + ((end.y - box.y - ry) / ry) ** 2;
      expect(k).toBeCloseTo(1, 1);
    }
  });
});
