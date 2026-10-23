import { type Diagram } from '@chartsia/core/model';
import { measureElement } from '@chartsia/core/shapes';
import { describe, expect, it } from 'vitest';
import { NEW_TEXT_BLOCK, newTextBlock } from '../../../src/canvas/text-block';
import { toReactFlow } from '../../../src/canvas/to-react-flow';

const empty = { elements: [], relations: [] } as Pick<Diagram, 'elements' | 'relations'>;

describe('newTextBlock', () => {
  it('crea un bloque de texto con un texto inicial editable en la posición dada', () => {
    const element = newTextBlock(empty, { x: 120.4, y: 80.6 });
    expect(element).toEqual({ id: 'Texto', kind: 'text', name: NEW_TEXT_BLOCK, layout: { x: 120, y: 81 } });
  });

  it('elige un id libre cuando ya hay bloques', () => {
    const diagram = { elements: [{ id: 'Texto', kind: 'text', name: 'a' }], relations: [] } as unknown as Pick<Diagram, 'elements' | 'relations'>;
    expect(newTextBlock(diagram, { x: 0, y: 0 }).id).toBe('Texto2');
  });
});

describe('bloque de texto en el lienzo', () => {
  it('se convierte en un nodo de tipo text con el tamaño que mide el núcleo', () => {
    const element = { id: 'Nota', kind: 'text' as const, name: '## Hola\n- uno', layout: { x: 10, y: 20 } };
    const diagram = { id: 'dg_aaaaaaaaaaaa', type: 'class', title: 'T', revision: 1, createdAt: '', updatedAt: '', elements: [element], relations: [] } as unknown as Diagram;
    const [node] = toReactFlow(diagram).nodes;
    expect(node).toMatchObject({ id: 'Nota', type: 'text', position: { x: 10, y: 20 } });
    expect({ width: node!.width, height: node!.height }).toEqual(measureElement(element));
  });
});
