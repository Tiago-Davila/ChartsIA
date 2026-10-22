import { ALLOWED_KINDS_BY_DIAGRAM, DIAGRAM_TYPES, type DiagramType } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { measureElement } from '@chartsia/core/shapes';
import { validateDiagram } from '@chartsia/core/validation';
import { describe, expect, it } from 'vitest';
import { centeredFreePoint, newPaletteEdit, newPaletteElements, PALETTE_ITEMS, paletteFor } from '../../../src/canvas/figure-palette';

const vacio = (type: DiagramType) => ({ type, title: 'Prueba', elements: [], relations: [] });

describe('barra de figuras', () => {
  it.each(DIAGRAM_TYPES)('cada figura de %s se crea como un elemento válido para el núcleo', (type) => {
    for (const item of paletteFor(type)) {
      const elements = newPaletteElements(vacio(type), item, { x: 10, y: 20 });
      const result = validateDiagram({ ...vacio(type), elements });
      expect(result.ok, `${item.key}: ${JSON.stringify(!result.ok && result.errors)}`).toBe(true);
    }
  });

  it.each(DIAGRAM_TYPES)('en %s solo ofrece kinds permitidos y todos los permitidos con botón', (type) => {
    const allowed = ALLOWED_KINDS_BY_DIAGRAM[type];
    const kinds = new Set(paletteFor(type).map((item) => item.kind));
    expect([...kinds].every((kind) => allowed.includes(kind))).toBe(true);
    // Las imágenes y los trazos se crean con sus propios botones.
    expect(allowed.filter((kind) => kind !== 'image' && kind !== 'drawing' && !kinds.has(kind))).toEqual([]);
  });

  it('las claves son únicas y cada tipo tiene su figura característica', () => {
    expect(new Set(PALETTE_ITEMS.map((item) => item.key)).size).toBe(PALETTE_ITEMS.length);
    expect(paletteFor('class').map((item) => item.key)).toContain('class');
    expect(paletteFor('c4-context').map((item) => item.key)).not.toContain('container');
    expect(paletteFor('c4-component').map((item) => item.key)).toContain('component');
    expect(paletteFor('er').map((item) => item.key)).toEqual(expect.arrayContaining(['entity', 'table', 'attribute', 'value-list']));
    expect(paletteFor('nosql').map((item) => item.key)).toContain('collection');
    expect(paletteFor('nosql').map((item) => item.key)).not.toContain('class');
  });

  it('la barra ofrece el pentágono, el heptágono y el octágono en cualquier tipo de diagrama', () => {
    for (const type of DIAGRAM_TYPES) {
      const keys = paletteFor(type).map((item) => item.key);
      expect(keys).toEqual(expect.arrayContaining(['figure-pentagon', 'figure-heptagon', 'figure-octagon']));
    }
  });

  it('la barra ofrece las cuatro variantes de triángulo', () => {
    const claves = paletteFor('class').map((item) => item.key);
    expect(claves).toEqual(expect.arrayContaining(['figure-equilateral-triangle', 'figure-isosceles-triangle', 'figure-scalene-triangle', 'figure-right-triangle']));
  });

  it('crea la figura general con su forma, nombre e id por defecto y posición redondeada', () => {
    const circulo = paletteFor('class').find((item) => item.key === 'figure-circle')!;
    expect(newPaletteElements(vacio('class'), circulo, { x: 10.6, y: 20.2 })).toEqual([{
      id: 'Circulo',
      name: 'Círculo',
      kind: 'figure',
      shape: 'circle',
      layout: { x: 11, y: 20 },
    }]);
  });

  it('ofrece la flecha simple, la doble y las de bloque, y cada una se crea con su forma', () => {
    const flechas = [['figure-arrow', 'arrow'], ['figure-double-arrow', 'double-arrow'], ['figure-arrow-right', 'arrow-right'], ['figure-arrow-left', 'arrow-left'], ['figure-arrow-up', 'arrow-up'], ['figure-arrow-down', 'arrow-down']] as const;
    const items = paletteFor('class');
    for (const [key, shape] of flechas) {
      const item = items.find((candidate) => candidate.key === key)!;
      expect(newPaletteElements(vacio('class'), item, { x: 0, y: 0 })[0]).toMatchObject({ kind: 'figure', shape });
    }
  });

  it('ofrece el óvalo, el rombo y el paralelogramo como figuras generales', () => {
    const claves = paletteFor('class').map((item) => item.key);
    expect(claves).toEqual(expect.arrayContaining(['figure-oval', 'figure-diamond', 'figure-parallelogram']));
  });

  it('repite la figura sin chocar con ids existentes', () => {
    const clase = paletteFor('class').find((item) => item.key === 'class')!;
    const [primera] = newPaletteElements(vacio('class'), clase, { x: 0, y: 0 });
    const [segunda] = newPaletteElements({ ...vacio('class'), elements: [primera!] }, clase, { x: 0, y: 0 });
    expect([primera!.id, primera!.name, segunda!.id, segunda!.name]).toEqual(['Clase', 'Clase', 'Clase2', 'Clase2']);
  });

  it('el elemento nuevo se aplica con add_element y queda fijado donde se soltó', () => {
    const tabla = paletteFor('er').find((item) => item.key === 'table')!;
    const diagram = { id: 'dg_aaaaaaaaaaaa', ...vacio('er'), revision: 0, createdAt: '', updatedAt: '' };
    const [element] = newPaletteElements(diagram, tabla, { x: 300, y: 150 });
    const result = applyOperations(diagram, [{ op: 'add_element', element }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram.elements[0]!.layout).toMatchObject({ x: 300, y: 150, pinned: true });
  });

  it('un componente de C4 componentes usa el límite de contenedor existente o crea uno con él', () => {
    const componente = paletteFor('c4-component').find((item) => item.key === 'component')!;
    const [limite, hijo] = newPaletteElements(vacio('c4-component'), componente, { x: 100, y: 100 });
    expect(limite).toMatchObject({ id: 'Limite', kind: 'boundary', boundaryType: 'container' });
    expect(hijo).toMatchObject({ id: 'Componente', parentId: 'Limite' });
    const [otro] = newPaletteElements({ ...vacio('c4-component'), elements: [limite!, hijo!] }, componente, { x: 300, y: 100 });
    expect(otro).toMatchObject({ id: 'Componente2', parentId: 'Limite' });
  });

  describe('doble clic: figura centrada sin tapar otra', () => {
    const circulo = paletteFor('class').find((item) => item.key === 'figure-circle')!;
    const { width: w, height: h } = measureElement(circulo.build('medida', 'Círculo'));
    // Caja de una figura ya puesta en el lienzo con su tamaño natural.
    const figuraEn = (id: string, x: number, y: number) => ({ id, name: id, kind: 'figure' as const, shape: 'circle' as const, layout: { x, y, width: w, height: h } });
    const tapan = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x < b.x + w && b.x < a.x + w && a.y < b.y + h && b.y < a.y + h;

    it('sin nada alrededor, la esquina deja la figura centrada en el punto indicado', () => {
      const point = centeredFreePoint(vacio('class'), circulo, { x: 500, y: 300 });
      expect(point).toEqual({ x: Math.round(500 - w / 2), y: Math.round(300 - h / 2) });
    });

    it('si el centro ya está ocupado, se corre en diagonal y no tapa el elemento existente', () => {
      const existente = figuraEn('Existente', 500 - w / 2, 300 - h / 2);
      const point = centeredFreePoint({ ...vacio('class'), elements: [existente] }, circulo, { x: 500, y: 300 });
      expect(point.x).toBeGreaterThan(500 - w / 2);
      expect(Math.abs(point.x - (500 - w / 2) - (point.y - (300 - h / 2)))).toBeLessThanOrEqual(1);
      expect(tapan(point, existente.layout)).toBe(false);
    });

    it('sigue corriendo mientras haya elementos encadenados en la diagonal', () => {
      const x0 = 500 - w / 2;
      const y0 = 300 - h / 2;
      const elements = [0, 1, 2, 3].map((i) => figuraEn(`F${i}`, x0 + i * 40, y0 + i * 40));
      const point = centeredFreePoint({ ...vacio('class'), elements }, circulo, { x: 500, y: 300 });
      for (const element of elements) expect(tapan(point, element.layout)).toBe(false);
    });

    it('la figura centrada y corrida se aplica como un solo lote válido para el núcleo', () => {
      const diagram = { id: 'dg_aaaaaaaaaaaa', ...vacio('class'), elements: [figuraEn('Existente', 500 - w / 2, 300 - h / 2)], revision: 1, createdAt: '', updatedAt: '' };
      const point = centeredFreePoint(diagram, circulo, { x: 500, y: 300 });
      const { elements, relations } = newPaletteEdit(diagram, circulo, point);
      const result = applyOperations(diagram, [...elements.map((element) => ({ op: 'add_element' as const, element })), ...relations.map((relation) => ({ op: 'add_relation' as const, relation }))]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.diagram.elements.map((e) => e.id)).toEqual(['Existente', 'Circulo']);
    });
  });
});
