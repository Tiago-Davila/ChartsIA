import { describe, expect, it } from 'vitest';
import { ElementSchema, FIGURE_SHAPES, type Element, type FigureShape } from '../../../src/model/index.js';
import { elementPrimitives, figureOutline, figureTextArea, measureElement, measureText, lineHeight } from '../../../src/shapes/index.js';

const figure = (shape: FigureShape, name: string): Element => ({ id: 'F', kind: 'figure', name, shape });
const NAMES = ['A', 'Internet', 'Servicio de autenticación', 'Un nombre bastante más largo que ocupa varias líneas dentro de la figura'];
const TRIANGLES = ['triangle', 'isosceles-triangle', 'equilateral-triangle', 'scalene-triangle', 'right-triangle'] as const;

/** Longitudes de los tres lados de un triángulo con ese nombre, de menor a mayor. */
function lados(shape: FigureShape, name = 'A'): number[] {
  const el = figure(shape, name);
  const v = figureOutline(shape, measureElement(el))!;
  return v.map((p, i) => Math.hypot(v[(i + 1) % 3]!.x - p.x, v[(i + 1) % 3]!.y - p.y)).sort((a, b) => a - b);
}

/** Indica si el punto cae dentro del polígono (regla de cruce de rayos). */
function insidePolygon(p: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

describe('forma figure', () => {
  it.each(FIGURE_SHAPES)('%s: mide por encima de su mínimo y es determinista', (shape) => {
    const size = measureElement(figure(shape, 'A'));
    expect(size.width).toBeGreaterThanOrEqual(60);
    expect(size.height).toBeGreaterThanOrEqual(60);
    expect(measureElement(figure(shape, 'A'))).toEqual(size);
  });

  it('círculo y cuadrado son siempre cuadrados', () => {
    for (const shape of ['circle', 'square'] as const) {
      for (const name of NAMES) {
        const { width, height } = measureElement(figure(shape, name));
        expect(width).toBe(height);
      }
    }
  });

  it('el rectángulo, el óvalo, el rombo, el paralelogramo, el hexágono y la nube son más anchos que altos con un nombre corto', () => {
    for (const shape of ['rectangle', 'oval', 'diamond', 'parallelogram', 'hexagon', 'cloud'] as const) {
      const { width, height } = measureElement(figure(shape, 'Cliente'));
      expect(width).toBeGreaterThan(height);
    }
  });

  it.each(FIGURE_SHAPES)('%s: el texto nunca se sale de su zona, para cualquier largo de nombre', (shape) => {
    for (const name of NAMES) {
      const size = measureElement(figure(shape, name));
      const area = figureTextArea(shape, size);
      const lines = elementPrimitives(figure(shape, name), size).filter((p) => p.type === 'text');
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines.length).toBeLessThanOrEqual(4);
      for (const line of lines) {
        expect(measureText(line.text, { size: line.size })).toBeLessThanOrEqual(area.width);
        expect(line.x).toBeCloseTo(area.x + area.width / 2);
      }
      const top = Math.min(...lines.map((l) => l.y - lineHeight(l.size) * 0.75));
      const bottom = Math.max(...lines.map((l) => l.y + lineHeight(l.size) * 0.25));
      expect(top).toBeGreaterThanOrEqual(area.y - 0.01);
      expect(bottom).toBeLessThanOrEqual(area.y + area.height + 0.01);
    }
  });

  it('un nombre largo agranda la figura y se parte en varias líneas', () => {
    const short = measureElement(figure('rectangle', 'A'));
    const long = measureElement(figure('rectangle', NAMES[3]!));
    expect(long.height).toBeGreaterThan(short.height);
    expect(elementPrimitives(figure('rectangle', NAMES[3]!), long).filter((p) => p.type === 'text').length).toBeGreaterThan(1);
  });

  it('cada forma dibuja su contorno con la primitiva esperada', () => {
    const outline = (shape: FigureShape) => {
      const el = figure(shape, 'X');
      return elementPrimitives(el, measureElement(el))[0]!.type;
    };
    expect(outline('circle')).toBe('ellipse');
    expect(outline('square')).toBe('rect');
    expect(outline('rectangle')).toBe('rect');
    for (const shape of TRIANGLES) expect(outline(shape)).toBe('path');
    expect(outline('hexagon')).toBe('path');
    expect(outline('diamond')).toBe('path');
    expect(outline('parallelogram')).toBe('path');
    expect(outline('oval')).toBe('ellipse');
    expect(outline('cloud')).toBe('path');
    expect(outline('pentagon')).toBe('path');
    expect(outline('heptagon')).toBe('path');
    expect(outline('octagon')).toBe('path');
  });

  it('el triángulo tiene 3 vértices, el rombo y el paralelogramo 4 y el hexágono 6, dentro de la caja', () => {
    const size = { width: 120, height: 104 };
    expect(figureOutline('triangle', size)).toHaveLength(3);
    expect(figureOutline('diamond', size)).toHaveLength(4);
    expect(figureOutline('parallelogram', size)).toHaveLength(4);
    expect(figureOutline('hexagon', size)).toHaveLength(6);
    expect(figureOutline('circle', size)).toBeUndefined();
    expect(figureOutline('oval', size)).toBeUndefined();
    for (const shape of [...TRIANGLES, 'diamond', 'parallelogram', 'hexagon'] as const) {
      for (const p of figureOutline(shape, size)!) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(size.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it('cada triángulo tiene la forma de su nombre', () => {
    const [equilatero1, , equilatero3] = lados('equilateral-triangle');
    expect(equilatero3! - equilatero1!).toBeLessThan(equilatero3! * 0.02);

    const [a, b, c] = lados('isosceles-triangle', 'Internet');
    expect(Math.min(Math.abs(a! - b!), Math.abs(b! - c!))).toBeLessThan(c! * 0.02);
    expect(c! - a!).toBeGreaterThan(c! * 0.05);

    const [escaleno1, escaleno2, escaleno3] = lados('scalene-triangle');
    expect(escaleno2! - escaleno1!).toBeGreaterThan(escaleno3! * 0.03);
    expect(escaleno3! - escaleno2!).toBeGreaterThan(escaleno3! * 0.03);

    const [catetoA, catetoB, hipotenusa] = lados('right-triangle');
    expect(Math.abs(catetoA! ** 2 + catetoB! ** 2 - hipotenusa! ** 2)).toBeLessThan(hipotenusa! ** 2 * 0.01);
  });

  it('acepta el pentágono, el heptágono y el octágono', () => {
    for (const shape of ['pentagon', 'heptagon', 'octagon']) {
      expect(ElementSchema.safeParse({ id: 'F', kind: 'figure', name: 'F', shape }).success).toBe(true);
    }
  });

  it('el pentágono, el heptágono y el octágono tienen 5, 7 y 8 vértices', () => {
    const size = { width: 120, height: 110 };
    expect(figureOutline('pentagon', size)).toHaveLength(5);
    expect(figureOutline('heptagon', size)).toHaveLength(7);
    expect(figureOutline('octagon', size)).toHaveLength(8);
  });

  it.each(['pentagon', 'heptagon', 'octagon'] as const)('%s: la zona del texto cabe dentro del contorno', (shape) => {
    for (const size of [{ width: 100, height: 100 }, { width: 260, height: 90 }, { width: 90, height: 240 }]) {
      const vertices = figureOutline(shape, size)!;
      const area = figureTextArea(shape, size);
      const corners = [
        { x: area.x, y: area.y },
        { x: area.x + area.width, y: area.y },
        { x: area.x, y: area.y + area.height },
        { x: area.x + area.width, y: area.y + area.height },
      ];
      for (const corner of corners) expect(insidePolygon(corner, vertices)).toBe(true);
    }
  });

  it('el nombre es editable en línea (slot name en la primera línea)', () => {
    const el = figure('circle', 'Cliente');
    const texts = elementPrimitives(el, measureElement(el)).filter((p) => p.type === 'text');
    expect(texts[0]).toMatchObject({ text: 'Cliente', slot: 'name', anchor: 'middle' });
  });

  it('el esquema exige shape y rechaza campos de otros kinds', () => {
    expect(ElementSchema.safeParse({ id: 'F', kind: 'figure', name: 'F' }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'F', kind: 'figure', name: 'F', shape: 'cloud', weak: true }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'F', kind: 'figure', name: 'F', shape: 'cloud' }).success).toBe(true);
  });
});
