import { type Diagram } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { describe, expect, it } from 'vitest';
import { copyElements, getClipboard, pasteOperations } from '../../../src/canvas/clipboard';

const diagram: Diagram = {
  id: 'dg_aaaaaaaaaaaa',
  type: 'class',
  title: 'Biblioteca',
  revision: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  elements: [
    { id: 'Libro', kind: 'class', name: 'Libro', attributes: [], operations: [], layout: { x: 100, y: 100 } },
    { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [], layout: { x: 400, y: 100 } },
    { id: 'Socio', kind: 'class', name: 'Socio', attributes: [], operations: [], layout: { x: 400, y: 300 } },
  ],
  relations: [
    { id: 'r1', kind: 'association', source: 'Libro', target: 'Autor' },
    { id: 'r2', kind: 'association', source: 'Libro', target: 'Socio' },
  ],
};

describe('portapapeles de elementos', () => {
  it('copia solo las flechas cuyos dos extremos se copiaron', () => {
    expect(copyElements(diagram, ['Libro', 'Autor'])).toBe(true);
    const clip = getClipboard()!;
    expect(clip.elements.map((e) => e.id)).toEqual(['Libro', 'Autor']);
    expect(clip.relations.map((r) => r.id)).toEqual(['r1']);
  });

  it('sin selección no copia nada y conserva lo anterior', () => {
    copyElements(diagram, ['Libro']);
    expect(copyElements(diagram, [])).toBe(false);
    expect(getClipboard()!.elements.map((e) => e.id)).toEqual(['Libro']);
  });

  it('pegar crea ids nuevos, reasigna las flechas y corre los elementos', () => {
    copyElements(diagram, ['Libro', 'Autor']);
    const ops = pasteOperations(getClipboard()!, diagram, 30);
    const elements = ops.filter((o) => o.op === 'add_element').map((o) => o.element);
    expect(elements.map((e) => e.id)).toEqual(['Libro_copia', 'Autor_copia']);
    expect(elements.map((e) => e.layout)).toEqual([{ x: 130, y: 130 }, { x: 430, y: 130 }]);
    const relation = ops.find((o) => o.op === 'add_relation')?.relation;
    expect(relation).toMatchObject({ id: 'r1_copia', source: 'Libro_copia', target: 'Autor_copia' });
  });

  it('el lote de pegado se aplica en un solo paso sobre el diagrama', () => {
    copyElements(diagram, ['Libro', 'Autor']);
    const result = applyOperations(diagram, pasteOperations(getClipboard()!, diagram, 30));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diagram.elements).toHaveLength(5);
      expect(result.diagram.relations).toHaveLength(3);
    }
  });

  it('en otro diagrama no desplaza y quita el grupo que no se copió', () => {
    const grouped: Diagram = {
      ...diagram,
      id: 'dg_bbbbbbbbbbbb',
      elements: [
        { id: 'Paquete', kind: 'package', name: 'Paquete', layout: { x: 0, y: 0, width: 600, height: 400 } },
        { ...diagram.elements[0]!, parentId: 'Paquete' },
      ],
      relations: [],
    };
    copyElements(grouped, ['Libro']);
    const target: Diagram = { ...diagram, id: 'dg_cccccccccccc', elements: [], relations: [] };
    const elements = pasteOperations(getClipboard()!, target, 0).map((o) => (o.op === 'add_element' ? o.element : undefined));
    expect(elements[0]).toMatchObject({ id: 'Libro_copia', layout: { x: 100, y: 100 } });
    expect(elements[0]).not.toHaveProperty('parentId');
  });
});
