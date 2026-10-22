import { describe, expect, it } from 'vitest';
import { ElementSchema, FIGURE_SHAPES, type Element, type FigureShape } from '../../../src/model/index.js';
import { elementPrimitives, figureOutline, figureTextArea, measureElement, measureText, lineHeight } from '../../../src/shapes/index.js';

const figure = (shape: FigureShape, name: string): Element => ({ id: 'F', kind: 'figure', name, shape });
const NAMES = ['A', 'Internet', 'Servicio de autenticación', 'Un nombre bastante más largo que ocupa varias líneas dentro de la figura'];

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
    expect(outline('triangle')).toBe('path');
    expect(outline('hexagon')).toBe('path');
    expect(outline('diamond')).toBe('path');
    expect(outline('parallelogram')).toBe('path');
    expect(outline('oval')).toBe('ellipse');
    expect(outline('cloud')).toBe('path');
  });

  it('el triángulo tiene 3 vértices, el rombo y el paralelogramo 4 y el hexágono 6, dentro de la caja', () => {
    const size = { width: 120, height: 104 };
    expect(figureOutline('triangle', size)).toHaveLength(3);
    expect(figureOutline('diamond', size)).toHaveLength(4);
    expect(figureOutline('parallelogram', size)).toHaveLength(4);
    expect(figureOutline('hexagon', size)).toHaveLength(6);
    expect(figureOutline('circle', size)).toBeUndefined();
    expect(figureOutline('oval', size)).toBeUndefined();
    for (const shape of ['triangle', 'diamond', 'parallelogram', 'hexagon'] as const) {
      for (const p of figureOutline(shape, size)!) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(size.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it('no existe el heptágono', () => {
    expect(FIGURE_SHAPES as readonly string[]).not.toContain('heptagon');
    expect(ElementSchema.safeParse({ id: 'F', kind: 'figure', name: 'F', shape: 'heptagon' }).success).toBe(false);
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
