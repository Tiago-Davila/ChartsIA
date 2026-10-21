import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { edgePrimitives } from '../../../src/render/edges.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';

const attribute = (name: string, extra: Record<string, unknown> = {}): Element => ({ id: 'A', kind: 'attribute', name, ...extra }) as Element;
const prims = (el: Element) => elementPrimitives(el, measureElement(el));

describe('forma attribute', () => {
  it('mide un óvalo con mínimo y crece con el nombre', () => {
    const short = measureElement(attribute('DNI'));
    expect(short).toEqual({ width: 90, height: 44 });
    expect(measureElement(attribute('Nombre completo del cliente registrado')).width).toBeGreaterThan(short.width);
  });

  it('dibuja un óvalo con el nombre editable en línea', () => {
    const [oval, ...rest] = prims(attribute('DNI'));
    expect(oval).toMatchObject({ type: 'ellipse', cx: 45, cy: 22, rx: 45, ry: 22 });
    expect(oval).not.toHaveProperty('dash');
    expect(rest).toMatchObject([{ type: 'text', text: 'DNI', slot: 'name', anchor: 'middle' }]);
    expect(rest[0]).not.toHaveProperty('underline');
  });

  it('la clave subraya el nombre', () => {
    const text = prims(attribute('DNI', { key: true })).find((p) => p.type === 'text');
    expect(text).toMatchObject({ underline: true });
  });

  it('el multivaluado es más grande y dibuja un segundo óvalo dentro', () => {
    const normal = measureElement(attribute('Teléfonos'));
    const multi = measureElement(attribute('Teléfonos', { multivalued: true }));
    expect(multi.width).toBeGreaterThan(normal.width);
    expect(multi.height).toBeGreaterThan(normal.height);
    const ovals = prims(attribute('Teléfonos', { multivalued: true })).filter((p) => p.type === 'ellipse');
    expect(ovals).toHaveLength(2);
    expect(ovals[1]!).toMatchObject({ type: 'ellipse', fill: 'none' });
    expect((ovals[1] as { rx: number }).rx).toBeLessThan((ovals[0] as { rx: number }).rx);
  });

  it('el derivado dibuja el borde discontinuo', () => {
    const [oval] = prims(attribute('Edad', { derived: true }));
    expect(oval).toHaveProperty('dash');
    expect(prims(attribute('Edad')).find((p) => p.type === 'ellipse')).not.toHaveProperty('dash');
  });

  it('las marcas se combinan: multivaluado y derivado dibujan dos óvalos discontinuos', () => {
    const ovals = prims(attribute('X', { multivalued: true, derived: true })).filter((p) => p.type === 'ellipse');
    expect(ovals).toHaveLength(2);
    expect(ovals.every((p) => 'dash' in p)).toBe(true);
  });
});

describe('forma value-list', () => {
  const list = (values: string[]): Element => ({ id: 'L', kind: 'value-list', name: 'Estados', values }) as Element;

  it('dibuja el título y una fila por valor, editable en línea', () => {
    const texts = prims(list(['pendiente', 'enviado'])).filter((p) => p.type === 'text');
    expect(texts).toMatchObject([
      { text: 'Estados', slot: 'name' },
      { text: 'pendiente', slot: 'value:0' },
      { text: 'enviado', slot: 'value:1' },
    ]);
  });

  it('crece una fila por valor y el ancho sigue al valor más largo', () => {
    const one = measureElement(list(['a']));
    const three = measureElement(list(['a', 'b', 'c']));
    expect(three.height).toBeGreaterThan(one.height);
    expect(measureElement(list(['un valor larguísimo que ensancha la lista de valores completa'])).width).toBeGreaterThan(one.width);
  });
});

describe('relación er-attr', () => {
  it('es una línea continua sin marcas en los extremos', () => {
    const route = [{ x: 0, y: 0 }, { x: 0, y: 80 }];
    const out = edgePrimitives({ id: 'r', kind: 'er-attr', source: 'A', target: 'B', route } as never);
    expect(out).toMatchObject([{ type: 'path', d: 'M 0 0 L 0 80' }]);
    expect(out[0]).not.toHaveProperty('dash');
  });
});
