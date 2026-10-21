import { describe, expect, it } from 'vitest';
import { sampleStroke, simplifyStroke } from '../../../src/canvas/drawing';

describe('simplificación del lápiz', () => {
  it('quita muestras cercanas y conserva los extremos', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 2 },
    ];
    const simplified = simplifyStroke(points, points);
    expect(simplified).toEqual([points[0], points[2], points[3]]);
  });

  it('acota trazos largos con muestreo lineal y preserva primer y último punto', () => {
    const points = Array.from({ length: 3000 }, (_, i) => ({ x: i * 3, y: i % 7 }));
    const reduced = sampleStroke(points, points, 1024);
    expect(reduced.points).toHaveLength(1024);
    expect(reduced.points[0]).toEqual(points[0]);
    expect(reduced.points.at(-1)).toEqual(points.at(-1));
    expect(reduced.screenPoints.at(-1)).toEqual(points.at(-1));
  });
});
