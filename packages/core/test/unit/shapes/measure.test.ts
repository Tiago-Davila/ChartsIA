import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { elementPrimitives, measureElement, measureText } from '../../../src/shapes/index.js';

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

describe('miembros UML', () => {
  const itf = (def: boolean): Element => ({
    id: 'I', kind: 'interface', name: 'I',
    operations: [{ name: 'describir', parameters: [], visibility: '+', ...(def ? { default: true } : {}) }],
  });
  const prims = (el: Element) => elementPrimitives(el, measureElement(el));
  const slot = (el: Element, name: string) => prims(el).find((p) => p.type === 'text' && p.slot === name);

  it('el método default lleva la palabra default y no va en cursiva', () => {
    expect(slot(itf(true), 'operation:0')).toMatchObject({ text: '+ default describir()' });
    expect(slot(itf(true), 'operation:0')).not.toHaveProperty('italic');
    expect(slot(itf(false), 'operation:0')).toMatchObject({ italic: true });
  });

  it('la clase abstracta muestra «abstract» y crece una línea', () => {
    const base = cls(0, 0);
    const abs = { ...base, abstract: true } as Element;
    expect(slot(abs, 'abstract')).toMatchObject({ text: '«abstract»' });
    expect(slot(base, 'abstract')).toBeUndefined();
    expect(measureElement(abs).height).toBeGreaterThan(measureElement(base).height);
  });

  it('el enum crece con atributos y operaciones', () => {
    const en: Element = { id: 'E', kind: 'enum', name: 'E', literals: ['A'] };
    const full: Element = { ...en, attributes: [{ name: 'x', visibility: '-' }], operations: [{ name: 'f', parameters: [], visibility: '+' }] };
    expect(measureElement(full).height).toBeGreaterThan(measureElement(en).height);
    expect(slot(full, 'attribute:0')).toBeDefined();
    expect(slot(full, 'operation:0')).toBeDefined();
  });
});

describe('medida con estilo', () => {
  const styled = (style: Extract<Element, { kind: 'class' }>['style'], name = 'Pedido'): Element => ({ ...cls(1, 1, name), style }) as Element;

  it('un fontSize mayor agranda el elemento y uno menor lo achica en alto', () => {
    const base = measureElement(cls(1, 1));
    const big = measureElement(styled({ fontSize: 24 }));
    const small = measureElement(styled({ fontSize: 10 }));
    expect(big.height).toBeGreaterThan(base.height);
    expect(small.height).toBeLessThan(base.height);
    expect(big.width).toBeGreaterThanOrEqual(base.width);
  });

  it('un fontSize igual al de referencia mide igual que sin estilo', () => {
    expect(measureElement(styled({ fontSize: 14 }))).toEqual(measureElement(cls(1, 1)));
    expect(measureElement(styled({ borderColor: '#000000', fillColor: '#ffffff' }))).toEqual(measureElement(cls(1, 1)));
  });

  it('el ancho depende de la familia: monoespaciada y manuscrita son distintas de la sans', () => {
    const text = 'Pedido de ejemplo con texto largo';
    const widths = (['sans-serif', 'serif', 'monospace', 'handwritten'] as const).map((fontFamily) => measureText(text, { size: 14, fontFamily }));
    expect(new Set(widths).size).toBeGreaterThanOrEqual(3);
    expect(widths.every((w) => w > 0)).toBe(true);
  });

  it('la monoespaciada mide igual cualquier carácter ASCII', () => {
    expect(measureText('iiiiii', { size: 14, fontFamily: 'monospace' })).toBe(measureText('WWWWWW', { size: 14, fontFamily: 'monospace' }));
  });

  it('la medida con estilo es determinista', () => {
    const el = styled({ fontFamily: 'handwritten', fontSize: 31 }, 'Préstamo «€»');
    expect(JSON.stringify(measureElement(el))).toBe(JSON.stringify(measureElement(el)));
  });

  it.each([
    { id: 'p', kind: 'person', name: 'Cliente', description: 'Compra productos en la tienda' },
    { id: 'c', kind: 'container', name: 'API', technology: 'Nest', variant: 'database' },
    { id: 'pk', kind: 'package', name: 'pkg' },
    { id: 'b', kind: 'boundary', name: 'Sistema', boundaryType: 'system' },
    { id: 'en', kind: 'entity', name: 'Cliente' },
    { id: 'at', kind: 'attribute', name: 'Nombre' },
    { id: 'f', kind: 'figure', name: 'Figura', shape: 'circle' },
  ] as Element[])('un fontSize mayor agranda $kind', (el) => {
    const base = measureElement(el);
    const big = measureElement({ ...el, style: { fontSize: 32 } } as Element);
    expect(big.width * big.height).toBeGreaterThan(base.width * base.height);
  });

  it('el texto dibujado usa la familia, el color y el tamaño del estilo', () => {
    const el = styled({ fontColor: '#112233', fontFamily: 'serif', fontSize: 28 });
    const texts = elementPrimitives(el, measureElement(el)).filter((p) => p.type === 'text');
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toMatchObject({ color: '#112233', fontFamily: 'serif' });
    expect(texts.find((t) => t.type === 'text' && t.slot === 'name')).toMatchObject({ size: 28 });
  });
});
