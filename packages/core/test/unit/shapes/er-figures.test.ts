import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { ElementSchema } from '../../../src/model/index.js';
import { edgePrimitives, offsetPolyline, totalSegment } from '../../../src/render/edges.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';
import { IDENTIFYING_GAP, rhombusPoints } from '../../../src/shapes/er/relationship.js';

const prims = (el: Element) => elementPrimitives(el, measureElement(el));
const paths = (el: Element) => prims(el).filter((p) => p.type === 'path');

describe('figuras ER nuevas', () => {
  it('el rombo de relación tiene dos vértices de más que su texto y un solo contorno', () => {
    const rel = { id: 'R', kind: 'relationship', name: 'Trabaja en' } as Element;
    const size = measureElement(rel);
    expect(size.width).toBeGreaterThanOrEqual(110);
    expect(size.height).toBeGreaterThanOrEqual(56);
    expect(paths(rel)).toHaveLength(1);
  });

  it('la relación identificante dibuja un segundo rombo interior y crece para dejarle espacio', () => {
    const plain = { id: 'R', kind: 'relationship', name: 'Tiene' } as Element;
    const ident = { ...plain, identifying: true } as Element;
    expect(paths(ident)).toHaveLength(2);
    expect(measureElement(ident).width).toBe(measureElement(plain).width + IDENTIFYING_GAP * 2);
  });

  it('rhombusPoints devuelve el rombo exterior y su versión desplazada hacia dentro', () => {
    expect(rhombusPoints(100, 60)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 30 },
      { x: 50, y: 60 },
      { x: 0, y: 30 },
    ]);
    const inner = rhombusPoints(100, 60, IDENTIFYING_GAP);
    expect(inner[0]!.y).toBeGreaterThan(0);
    expect(inner[1]!.x).toBeLessThan(100);
  });

  it('la especialización muestra d por defecto y o cuando las subclases se solapan', () => {
    const disjoint = { id: 'S', kind: 'specialization', name: 'Tipo' } as Element;
    const overlapping = { ...disjoint, overlapping: true } as Element;
    const letter = (el: Element) => prims(el).find((p) => p.type === 'text' && p.slot === 'kind');
    expect(letter(disjoint)).toMatchObject({ text: 'd' });
    expect(letter(overlapping)).toMatchObject({ text: 'o' });
  });

  it('la especialización pone su nombre debajo del triángulo', () => {
    const el = { id: 'S', kind: 'specialization', name: 'Tipo' } as Element;
    const name = prims(el).find((p) => p.type === 'text' && p.slot === 'name');
    expect(name).toMatchObject({ text: 'Tipo', anchor: 'middle' });
    expect((name as { y: number }).y).toBeGreaterThan(40);
  });

  it('la entidad asociativa tiene el borde discontinuo y la débil no', () => {
    const plain = { id: 'E', kind: 'entity', name: 'E' } as Element;
    expect(prims(plain)[0]).not.toHaveProperty('dash');
    expect(prims({ ...plain, associative: true } as Element)[0]).toHaveProperty('dash');
  });

  it('la clave parcial subraya el nombre con una línea discontinua; la clave completa usa subrayado de texto', () => {
    const partial = { id: 'A', kind: 'attribute', name: 'Nombre', partialKey: true } as Element;
    const line = prims(partial).find((p) => p.type === 'line');
    expect(line).toMatchObject({ type: 'line', dash: [6, 4] });
    const key = { id: 'A', kind: 'attribute', name: 'Nombre', key: true } as Element;
    expect(prims(key).some((p) => p.type === 'line')).toBe(false);
  });
});

describe('participación total', () => {
  const route = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ];

  it('la mitad de la ruta que toca el origen llega hasta el punto medio de la longitud', () => {
    expect(totalSegment(route, 'start')).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(totalSegment(route, 'end')).toEqual([{ x: 100, y: 0 }, { x: 100, y: 100 }]);
  });

  it('offsetPolyline desplaza los tramos y une la esquina en su intersección', () => {
    // Tramo a la derecha desplazado a y=+d, tramo hacia abajo desplazado a x=-d.
    expect(offsetPolyline(route, 4)).toEqual([
      { x: 0, y: 4 },
      { x: 96, y: 4 },
      { x: 96, y: 100 },
    ]);
  });

  it('dibuja una segunda línea en la mitad de la ruta, sin cambiar la línea principal', () => {
    const base = { id: 'r', kind: 'er-rel', source: 'A', target: 'B', sourceCardinality: 'one', targetCardinality: 'one', route } as const;
    const plain = edgePrimitives(base as never);
    const total = edgePrimitives({ ...base, sourceTotal: true } as never);
    expect(total.length).toBe(plain.length + 1);
  });
});

describe('esquemas de las figuras ER', () => {
  it('acepta relación, especialización y los nuevos campos de entidad y atributo', () => {
    expect(ElementSchema.safeParse({ id: 'R', kind: 'relationship', name: 'R', identifying: true }).success).toBe(true);
    expect(ElementSchema.safeParse({ id: 'S', kind: 'specialization', name: 'S', overlapping: true }).success).toBe(true);
    expect(ElementSchema.safeParse({ id: 'E', kind: 'entity', name: 'E', associative: true }).success).toBe(true);
    expect(ElementSchema.safeParse({ id: 'A', kind: 'attribute', name: 'A', partialKey: true }).success).toBe(true);
  });

  it('rechaza los campos nuevos en kinds que no los admiten', () => {
    expect(ElementSchema.safeParse({ id: 'E', kind: 'entity', name: 'E', partialKey: true }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'R', kind: 'relationship', name: 'R', weak: true }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'S', kind: 'specialization', name: 'S', identifying: true }).success).toBe(false);
  });
});
