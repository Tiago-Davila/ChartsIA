import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutDiagram } from '../../../src/layout/index.js';
import type { Diagram } from '../../../src/model/index.js';
import { edgesCrossingNodes, overlappingPairs } from '../../support/geometry.js';

describe('layout de tablas er con FK', () => {
  it('dispone las tablas sin solapes y enruta las er-rel entre ellas', async () => {
    const raw = JSON.parse(readFileSync(new URL('../../golden/fixtures/shop-er-tables.json', import.meta.url), 'utf8'));
    const diagram = { ...raw, id: 'dg_aaaaaaaaaaaa', revision: 1, createdAt: 'x', updatedAt: 'x' } as Diagram;
    const a = await layoutDiagram(diagram);
    expect(JSON.stringify(await layoutDiagram(diagram))).toBe(JSON.stringify(a));
    expect(overlappingPairs(a)).toEqual([]);
    expect(edgesCrossingNodes(a)).toEqual([]);
    expect(a.relations.every((r) => (r.route?.length ?? 0) >= 2)).toBe(true);
  });
});
