import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { measureElement, measureText } from '../../../src/shapes/index.js';

const cls = (attrs: number, ops: number, name = 'Pedido'): Element => ({
  id: 'A',
  kind: 'class',
  name,
  attributes: Array.from({ length: attrs }, (_, i) => ({ name: `campo${i}`, type: 'String', visibility: '-' as const })),
  operations: Array.from({ length: ops }, (_, i) => ({ name: `op${i}`, parameters: [], visibility: '+' as const })),
});

describe('medida de formas', () => {
  it('el alto de una clase crece con atributos y operaciones', () => {
    const a = measureElement(cls(0, 0));
    const b = measureElement(cls(3, 0));
    const c = measureElement(cls(3, 2));
    expect(b.height).toBeGreaterThan(a.height);
    expect(c.height).toBeGreaterThan(b.height);
  });

  it('el ancho crece con el texto más largo', () => {
    const short = measureElement(cls(0, 0, 'A'));
    const long = measureElement(cls(0, 0, 'NombreDeClaseMuyLargoParaProbarElAncho'));
    expect(long.width).toBeGreaterThan(short.width);
  });

  it('es determinista (tabla de métricas fija)', () => {
    const el = cls(5, 5, 'Préstamo «€»');
    const runs = Array.from({ length: 5 }, () => measureElement(el));
    expect(new Set(runs.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(measureText('Hola mundo', { size: 14 })).toBe(measureText('Hola mundo', { size: 14 }));
  });

  it('el texto en negrita y más grande es más ancho', () => {
    const normal = measureText('Pedido', { size: 14 });
    expect(measureText('Pedido', { size: 14, bold: true })).toBeGreaterThan(normal);
    expect(measureText('Pedido', { size: 18 })).toBeGreaterThan(normal);
  });

  it.each([
    { id: 'p', kind: 'person', name: 'Cliente', description: 'Compra productos en la tienda' },
    { id: 's', kind: 'software-system', name: 'Tienda' },
    { id: 'c', kind: 'container', name: 'API', technology: 'Nest', variant: 'database' },
    { id: 'k', kind: 'component', name: 'Ctrl' },
    { id: 'e', kind: 'enum', name: 'Estado', literals: ['A', 'B'] },
    { id: 'i', kind: 'interface', name: 'I', operations: [] },
    { id: 'pk', kind: 'package', name: 'pkg' },
    { id: 'b', kind: 'boundary', name: 'Sistema', boundaryType: 'system' },
  ] as Element[])('mide $kind con tamaño positivo', (el) => {
    const size = measureElement(el);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});
