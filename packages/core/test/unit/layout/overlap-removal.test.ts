import { describe, expect, it } from 'vitest';
import { removeOverlaps, type LayoutBox } from '../../../src/layout/index.js';
import { overlaps } from '../../support/geometry.js';

const box = (id: string, x: number, y: number, pinned = false, w = 100, h = 50): LayoutBox => ({ id, x, y, width: w, height: h, pinned });

describe('removeOverlaps', () => {
  it('separa nodos solapados moviendo solo los no fijados', () => {
    const input = [box('a', 0, 0, true), box('b', 50, 10), box('c', 300, 0)];
    const { boxes } = removeOverlaps(input);
    const byId = Object.fromEntries(boxes.map((b) => [b.id, b]));
    expect(byId.a).toMatchObject({ x: 0, y: 0 });
    expect(byId.c).toMatchObject({ x: 300, y: 0 });
    expect(overlaps(byId.a!, byId.b!)).toBe(false);
  });

  it('desplazamiento mínimo', () => {
    const { boxes } = removeOverlaps([box('a', 0, 0, true), box('b', 90, 0)]);
    const b = boxes.find((x) => x.id === 'b')!;
    // basta empujarlo a la derecha más el margen: no se va lejos
    expect(b.y).toBe(0);
    expect(b.x).toBeGreaterThanOrEqual(100);
    expect(b.x).toBeLessThanOrEqual(130);
  });

  it('no mueve nada si no hay solapes', () => {
    const input = [box('a', 0, 0), box('b', 200, 0), box('c', 0, 200)];
    expect(removeOverlaps(input).boxes).toEqual(input);
  });

  it('prioriza mover los nodos "nuevos" frente a los existentes', () => {
    const { boxes } = removeOverlaps([box('z-old', 0, 0), { ...box('a-new', 20, 0), isNew: true }]);
    expect(boxes.find((b) => b.id === 'z-old')).toMatchObject({ x: 0, y: 0 });
  });

  it('es determinista', () => {
    const input = Array.from({ length: 30 }, (_, i) => box(`n${i}`, (i * 37) % 200, (i * 53) % 150));
    const a = removeOverlaps(input);
    const b = removeOverlaps([...input].reverse());
    const norm = (r: typeof a) => JSON.stringify([...r.boxes].sort((x, y) => x.id.localeCompare(y.id)));
    expect(norm(a)).toBe(norm(b));
    for (const p of a.boxes) for (const q of a.boxes) if (p.id < q.id) expect(overlaps(p, q)).toBe(false);
  });

  it('dos fijados solapados se dejan y generan un warning', () => {
    const { boxes, warnings } = removeOverlaps([box('a', 0, 0, true), box('b', 10, 10, true)]);
    expect(boxes.map((b) => [b.x, b.y])).toEqual([[0, 0], [10, 10]]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/a.*b|b.*a/);
  });
});
