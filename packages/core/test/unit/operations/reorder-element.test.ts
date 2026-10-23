import { describe, expect, it } from 'vitest';
import type { Diagram, Element } from '../../../src/model/index.js';
import { applyOperations } from '../../../src/operations/index.js';
import { codes } from '../../support/fixtures.js';

const cls = (id: string, parentId?: string): Element =>
  ({ id, kind: 'class', name: id, attributes: [], operations: [], ...(parentId ? { parentId } : {}) }) as Element;

function diagramOf(elements: Element[]): Diagram {
  return {
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title: 'Orden',
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    elements,
    relations: [],
  };
}

const order = (d: Diagram) => d.elements.map((e) => e.id);
const reorder = (elements: Element[], ops: { id: string; to: 'front' | 'back' | 'forward' | 'backward' }[]) =>
  applyOperations(diagramOf(elements), ops.map((o) => ({ op: 'reorder_element', ...o })));

describe('reorder_element', () => {
  it('front y back mueven el elemento al final y al principio del array', () => {
    const res = reorder([cls('a'), cls('b'), cls('c')], [{ id: 'c', to: 'back' }]);
    expect(res.ok && order(res.diagram)).toEqual(['c', 'a', 'b']);

    const front = reorder([cls('a'), cls('b'), cls('c')], [{ id: 'a', to: 'front' }]);
    expect(front.ok && order(front.diagram)).toEqual(['b', 'c', 'a']);
  });

  it('forward y backward saltan sobre el siguiente o anterior elemento del mismo nivel', () => {
    const elements = [cls('a'), { id: 'g', kind: 'package', name: 'g' } as Element, cls('b'), cls('c')];
    const up = reorder(elements, [{ id: 'a', to: 'forward' }]);
    expect(up.ok && order(up.diagram)).toEqual(['g', 'b', 'a', 'c']);

    const down = reorder(elements, [{ id: 'c', to: 'backward' }]);
    expect(down.ok && order(down.diagram)).toEqual(['a', 'g', 'c', 'b']);
  });

  it('forward sin ningún elemento del mismo nivel por encima deja el orden igual', () => {
    const res = reorder([cls('a'), cls('b')], [{ id: 'b', to: 'forward' }]);
    expect(res.ok && order(res.diagram)).toEqual(['a', 'b']);
  });

  it('no mueve posiciones ni otros campos del elemento', () => {
    const socio = { ...cls('Socio'), layout: { x: 10, y: 20, width: 100, height: 50, pinned: false } } as Element;
    const res = reorder([socio, cls('a')], [{ id: 'Socio', to: 'front' }]);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'Socio')).toEqual(socio);
  });

  it('un id inexistente devuelve UNKNOWN_REFERENCE con path del id', () => {
    const res = reorder([cls('a')], [{ id: 'nadie', to: 'front' }]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(codes(res.errors)).toEqual(['UNKNOWN_REFERENCE']);
      expect(res.errors[0]?.path).toBe('/operations/0/id');
    }
  });

  it('un destino fuera de la lista se rechaza con SCHEMA_VIOLATION', () => {
    const res = applyOperations(diagramOf([cls('a')]), [{ op: 'reorder_element', id: 'a', to: 'arriba' }]);
    expect(!res.ok && codes(res.errors)).toContain('SCHEMA_VIOLATION');
  });
});
