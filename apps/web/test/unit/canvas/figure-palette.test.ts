import { ALLOWED_KINDS_BY_DIAGRAM, DIAGRAM_TYPES, type DiagramType } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { validateDiagram } from '@chartsia/core/validation';
import { describe, expect, it } from 'vitest';
import { newPaletteElements, PALETTE_ITEMS, paletteFor } from '../../../src/canvas/figure-palette';

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
});
