import { describe, expect, it } from 'vitest';
import { DRAWING_MAX_POINTS, ElementSchema, type Element } from '../../../src/model/index.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';

const drawing = (
  points = [
    { x: 2, y: 3 },
    { x: 30, y: 40 },
  ],
): Element => ({
  id: 'Trazo',
  kind: 'drawing',
  name: 'Trazo',
  points,
  strokeColor: '#b42318',
  strokeWidth: 2,
});

describe('drawing', () => {
  it('valida puntos, color y grosor dentro de sus límites', () => {
    expect(ElementSchema.safeParse(drawing()).success).toBe(true);
    expect(
      ElementSchema.safeParse({
        ...drawing(),
        points: [
          { x: -1, y: 0 },
          { x: 1, y: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      ElementSchema.safeParse({
        ...drawing(),
        points: [
          { x: 0, y: 0 },
          { x: 5001, y: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      ElementSchema.safeParse({
        ...drawing(),
        points: Array.from({ length: DRAWING_MAX_POINTS + 1 }, (_, i) => ({ x: i, y: 0 })),
      }).success,
    ).toBe(false);
    expect(
      ElementSchema.safeParse({ ...drawing(), strokeColor: 'url(javascript:alert(1))' }).success,
    ).toBe(false);
    expect(ElementSchema.safeParse({ ...drawing(), strokeWidth: 100 }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...drawing(), layout: { x: Infinity, y: 0 } }).success).toBe(
      false,
    );
  });

  it('mide la caja y dibuja un único path con extremos redondeados', () => {
    const element = drawing();
    expect(measureElement(element)).toEqual({ width: 31, height: 41 });
    expect(elementPrimitives(element, measureElement(element))).toEqual([
      {
        type: 'path',
        d: 'M 2 3 L 30 40',
        fill: 'none',
        stroke: '#b42318',
        strokeWidth: 2,
        lineCap: 'round',
        lineJoin: 'round',
      },
    ]);
  });
});
