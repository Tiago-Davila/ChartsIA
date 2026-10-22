import { DIAGRAM_TYPES, type DiagramType } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { measureElement } from '@chartsia/core/shapes';
import { validateDiagram } from '@chartsia/core/validation';
import { describe, expect, it } from 'vitest';
import { centeredFreePoint, newPaletteEdit, newPaletteElements, PALETTE_ITEMS } from '../../../src/canvas/figure-palette';

const vacio = (type: DiagramType) => ({ type, title: 'Prueba', elements: [], relations: [] });
const claves = () => PALETTE_ITEMS.map((item) => item.key);
const item = (key: string) => PALETTE_ITEMS.find((candidate) => candidate.key === key)!;

describe('barra de figuras', () => {
  it.each(DIAGRAM_TYPES)('cada figura se crea como un elemento válido para el núcleo en %s', (type) => {
    for (const figura of PALETTE_ITEMS) {
      const elements = newPaletteElements(vacio(type), figura, { x: 10, y: 20 });
      const result = validateDiagram({ ...vacio(type), elements });
      expect(result.ok, `${figura.key}: ${JSON.stringify(!result.ok && result.errors)}`).toBe(true);
    }
  });

  it('ofrece todas las figuras, de clases, C4, ER, NoSQL y generales, sin importar el tipo de diagrama', () => {
    expect(claves()).toEqual(expect.arrayContaining(['class', 'person', 'container', 'entity', 'table', 'collection', 'figure-circle', 'frame']));
    // Las imágenes y los trazos tienen sus propios botones.
    expect(claves()).not.toContain('image');
    expect(claves()).not.toContain('drawing');
  });

  it('las claves son únicas', () => {
    expect(new Set(claves()).size).toBe(PALETTE_ITEMS.length);
  });

  it('la barra ofrece el pentágono, el heptágono y el octágono', () => {
    expect(claves()).toEqual(expect.arrayContaining(['figure-pentagon', 'figure-heptagon', 'figure-octagon']));
  });

  it('la barra ofrece las cuatro variantes de triángulo', () => {
    expect(claves()).toEqual(expect.arrayContaining(['figure-equilateral-triangle', 'figure-isosceles-triangle', 'figure-scalene-triangle', 'figure-right-triangle']));
  });

  it('crea la figura general con su forma, nombre e id por defecto y posición redondeada', () => {
    expect(newPaletteElements(vacio('class'), item('figure-circle'), { x: 10.6, y: 20.2 })).toEqual([{
      id: 'Circulo',
      name: 'Círculo',
      kind: 'figure',
      shape: 'circle',
      layout: { x: 11, y: 20 },
    }]);
  });

  it('ofrece la flecha simple, la doble y las de bloque, y cada una se crea con su forma', () => {
    const flechas = [['figure-arrow', 'arrow'], ['figure-double-arrow', 'double-arrow'], ['figure-arrow-right', 'arrow-right'], ['figure-arrow-left', 'arrow-left'], ['figure-arrow-up', 'arrow-up'], ['figure-arrow-down', 'arrow-down']] as const;
    for (const [key, shape] of flechas) {
      expect(newPaletteElements(vacio('class'), item(key), { x: 0, y: 0 })[0]).toMatchObject({ kind: 'figure', shape });
    }
  });

  it('ofrece el óvalo, el rombo y el paralelogramo como figuras generales', () => {
    expect(claves()).toEqual(expect.arrayContaining(['figure-oval', 'figure-diamond', 'figure-parallelogram']));
  });

  it('repite la figura sin chocar con ids existentes', () => {
    const [primera] = newPaletteElements(vacio('class'), item('class'), { x: 0, y: 0 });
    const [segunda] = newPaletteElements({ ...vacio('class'), elements: [primera!] }, item('class'), { x: 0, y: 0 });
    expect([primera!.id, primera!.name, segunda!.id, segunda!.name]).toEqual(['Clase', 'Clase', 'Clase2', 'Clase2']);
  });

  it('el elemento nuevo se aplica con add_element y queda fijado donde se soltó', () => {
    const diagram = { id: 'dg_aaaaaaaaaaaa', ...vacio('er'), revision: 0, createdAt: '', updatedAt: '' };
    const [element] = newPaletteElements(diagram, item('table'), { x: 300, y: 150 });
    const result = applyOperations(diagram, [{ op: 'add_element', element }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.diagram.elements[0]!.layout).toMatchObject({ x: 300, y: 150, pinned: true });
  });

  it('un componente de C4 usa el límite de contenedor existente o crea uno con él, también fuera de C4', () => {
    const componente = item('component');
    const [limite, hijo] = newPaletteElements(vacio('class'), componente, { x: 100, y: 100 });
    expect(limite).toMatchObject({ id: 'Limite', kind: 'boundary', boundaryType: 'container' });
    expect(hijo).toMatchObject({ id: 'Componente', parentId: 'Limite' });
    const [otro] = newPaletteElements({ ...vacio('class'), elements: [limite!, hijo!] }, componente, { x: 300, y: 100 });
    expect(otro).toMatchObject({ id: 'Componente2', parentId: 'Limite' });
  });

  describe('doble clic: figura centrada sin tapar otra', () => {
    const circulo = PALETTE_ITEMS.find((item) => item.key === 'figure-circle')!;
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
