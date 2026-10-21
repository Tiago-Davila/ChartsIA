import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { edgePrimitives } from '../../../src/render/edges.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';
import { relationStyle } from '../../../src/shapes/uml/markers.js';

const entity = (name: string, weak?: boolean): Element => ({ id: 'E', kind: 'entity', name, ...(weak ? { weak } : {}) });
const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
const rel = (extra: Record<string, unknown>) =>
  ({ id: 'r', kind: 'er-rel', source: 'A', target: 'B', sourceCardinality: 'one', targetCardinality: 'one', route, ...extra }) as never;

describe('forma entity', () => {
  it('mide un rectángulo con mínimo y crece con el nombre', () => {
    const short = measureElement(entity('A'));
    expect(short).toEqual({ width: 120, height: 48 });
    expect(measureElement(entity('NombreDeEntidadMuyLargoParaProbarElAncho')).width).toBeGreaterThan(short.width);
  });

  it('la débil es más grande y dibuja un segundo borde', () => {
    const normal = measureElement(entity('Línea'));
    const weak = measureElement(entity('Línea', true));
    expect(weak.height).toBeGreaterThan(normal.height);
    expect(elementPrimitives(entity('Línea'), normal).filter((p) => p.type === 'rect')).toHaveLength(1);
    expect(elementPrimitives(entity('Línea', true), weak).filter((p) => p.type === 'rect')).toHaveLength(2);
  });

  it('el nombre es editable en línea (slot name)', () => {
    const texts = elementPrimitives(entity('Cliente'), { width: 120, height: 48 }).filter((p) => p.type === 'text');
    expect(texts).toMatchObject([{ text: 'Cliente', slot: 'name' }]);
  });
});

describe('relación er-rel', () => {
  it('identificante es continua y no identificante discontinua', () => {
    expect(relationStyle({ kind: 'er-rel', identifying: true }).dash).toBeUndefined();
    expect(relationStyle({ kind: 'er-rel' }).dash).toBeDefined();
  });

  it('cada cardinalidad dibuja su marca en el extremo', () => {
    const marks = (sourceCardinality: string) => edgePrimitives(rel({ sourceCardinality, identifying: true })).filter((p) => p.type !== 'text');
    // línea + marca en source + marca "one" en target (dos barras)
    expect(marks('one')).toHaveLength(1 + 2 + 2);
    expect(marks('zero-one').map((p) => p.type)).toContain('ellipse');
    expect(marks('one-many')).toHaveLength(1 + 4 + 2);
    expect(marks('zero-many').map((p) => p.type)).toContain('ellipse');
  });

  it('las marcas quedan sobre el extremo y la línea no las cruza', () => {
    const [line, ...marks] = edgePrimitives(rel({ sourceCardinality: 'zero-many', targetCardinality: 'one', identifying: true }));
    expect(line).toMatchObject({ type: 'path', d: 'M 22 0 L 88 0' });
    expect(marks.some((p) => p.type === 'ellipse' && p.cx === 17 && p.cy === 0)).toBe(true);
  });
});
