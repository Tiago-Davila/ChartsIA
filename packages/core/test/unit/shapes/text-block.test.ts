import { describe, expect, it } from 'vitest';
import { ElementSchema, type Element } from '../../../src/model/index.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';
import { CODE_FILL, TOKEN_COLORS } from '../../../src/shapes/general/text-block.js';
import { type Primitive } from '../../../src/shapes/types.js';

const block = (name: string, extra: Record<string, unknown> = {}): Element =>
  ElementSchema.parse({ id: 'T', kind: 'text', name, ...extra }) as Element;

const texts = (primitives: Primitive[]) => primitives.filter((p): p is Extract<Primitive, { type: 'text' }> => p.type === 'text');

describe('bloque de texto', () => {
  it('su tamaño crece con el contenido', () => {
    const short = measureElement(block('Hola'));
    const long = measureElement(block('Hola. '.repeat(40)));
    expect(long.height).toBeGreaterThan(short.height);
    expect(long.width).toBeGreaterThan(0);
  });

  it('un párrafo largo se parte en líneas y ninguna se pasa del ancho de envoltura', () => {
    const size = measureElement(block('palabra '.repeat(60)));
    expect(size.width).toBeLessThanOrEqual(360 + 2 * 8 + 2);
    const lines = new Set(texts(elementPrimitives(block('palabra '.repeat(60)), size)).map((t) => t.y));
    expect(lines.size).toBeGreaterThan(1);
  });

  it('un título es más grande y negrita que un párrafo', () => {
    const title = texts(elementPrimitives(block('# Título'), measureElement(block('# Título'))))[0]!;
    const body = texts(elementPrimitives(block('Título'), measureElement(block('Título'))))[0]!;
    expect(title.size).toBeGreaterThan(body.size);
    expect(title.bold).toBe(true);
    expect(body.bold).toBeUndefined();
  });

  it('la negrita y la cursiva se dibujan en su propio trozo', () => {
    const el = block('uno **dos** *tres*');
    const pieces = texts(elementPrimitives(el, measureElement(el)));
    expect(pieces.map((p) => p.text)).toEqual(['uno', 'dos', 'tres']);
    expect(pieces[1]!.bold).toBe(true);
    expect(pieces[2]!.italic).toBe(true);
    // Los trozos de una misma línea van uno a continuación del otro, sin solaparse.
    expect(pieces[1]!.x).toBeGreaterThan(pieces[0]!.x);
    expect(pieces[2]!.x).toBeGreaterThan(pieces[1]!.x);
  });

  it('las listas llevan viñeta o número y cada elemento va en su línea', () => {
    const el = block('- uno\n- dos\n\n1. a\n2. b');
    const pieces = texts(elementPrimitives(el, measureElement(el))).map((p) => p.text);
    expect(pieces.filter((t) => t === '•')).toHaveLength(2);
    expect(pieces).toEqual(expect.arrayContaining(['1.', '2.', 'a', 'b']));
  });

  it('un bloque de código dibuja su recuadro, el lenguaje y el texto coloreado', () => {
    const el = block('```ts\nconst a = 1;\n```');
    const primitives = elementPrimitives(el, measureElement(el));
    const box = primitives.find((p) => p.type === 'rect' && p.fill === CODE_FILL);
    expect(box).toBeDefined();
    const pieces = texts(primitives);
    expect(pieces.find((t) => t.text === 'ts')).toBeDefined();
    expect(pieces.find((t) => t.text === 'const')?.color).toBe(TOKEN_COLORS.keyword);
    expect(pieces.find((t) => t.text === '1')?.color).toBe(TOKEN_COLORS.number);
    expect(pieces.find((t) => t.text === 'const')?.fontFamily).toBe('monospace');
  });

  it('cada texto lleva el slot name para la edición en línea', () => {
    const el = block('Hola *mundo*');
    for (const piece of texts(elementPrimitives(el, measureElement(el)))) expect(piece.slot).toBe('name');
  });

  it('sin relleno ni borde no tiene marco; con relleno en el estilo sí', () => {
    const plain = block('Hola');
    expect(elementPrimitives(plain, measureElement(plain)).some((p) => p.type === 'rect')).toBe(false);
    const framed = block('Hola', { style: { fillColor: '#fff7ed' } });
    expect(elementPrimitives(framed, measureElement(framed))[0]).toMatchObject({ type: 'rect', fill: '#fff7ed' });
  });

  it('el color de texto del estilo se aplica al texto normal', () => {
    const el = block('Hola', { style: { fontColor: '#7c2d12' } });
    expect(texts(elementPrimitives(el, measureElement(el)))[0]!.color).toBe('#7c2d12');
  });

  it('el mismo texto siempre mide y se dibuja igual', () => {
    const md = '# T\n\n- **a**\n```py\nx = 1\n```';
    expect(measureElement(block(md))).toEqual(measureElement(block(md)));
    expect(elementPrimitives(block(md), measureElement(block(md)))).toEqual(elementPrimitives(block(md), measureElement(block(md))));
  });
});

describe('esquema del bloque de texto', () => {
  it('rechaza un texto vacío y uno que supera el máximo', () => {
    expect(ElementSchema.safeParse({ id: 'T', kind: 'text', name: '' }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'T', kind: 'text', name: 'x'.repeat(4001) }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'T', kind: 'text', name: 'x'.repeat(4000) }).success).toBe(true);
  });

  it('no acepta campos de otros kinds', () => {
    expect(ElementSchema.safeParse({ id: 'T', kind: 'text', name: 'x', shape: 'circle' }).success).toBe(false);
  });
});
