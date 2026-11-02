import { describe, expect, it } from 'vitest';
import { layoutDiagram, warmUpLayout } from '../../../src/layout/index.js';
import type { Diagram } from '../../../src/model/index.js';
import { overlappingPairs } from '../../support/geometry.js';

/** Diagrama de n clases unidas en árbol, para medir el layout con muchos elementos. */
function grid(n: number): Diagram {
  const elements = Array.from({ length: n }, (_, i) => ({ id: `C${i}`, kind: 'class' as const, name: `Clase${i}`, attributes: [], operations: [] }));
  const relations = Array.from({ length: n - 1 }, (_, i) => ({
    id: `r${i}`, kind: 'association' as const, source: `C${i + 1}`, target: `C${Math.floor(i / 3)}`,
  }));
  return {
    type: 'class', title: 'Grande', elements, relations,
    id: 'dg_aaaaaaaaaaaa', revision: 0, createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
  };
}

describe('rendimiento del layout', () => {
  it('dispone 200 elementos en menos de 1 s (servidor en caliente)', async () => {
    await warmUpLayout();
    let mejor = Infinity;
    let out = await layoutDiagram(grid(200));
    // El mejor de 3 descarta los picos de carga de la máquina.
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      out = await layoutDiagram(grid(200));
      mejor = Math.min(mejor, performance.now() - start);
    }
    expect(mejor).toBeLessThan(1000);
    expect(overlappingPairs(out)).toEqual([]);
  }, 30_000);
});
