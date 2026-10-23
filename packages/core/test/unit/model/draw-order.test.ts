import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { drawOrder } from '../../../src/model/index.js';

const cls = (id: string, parentId?: string): Element =>
  ({ id, kind: 'class', name: id, attributes: [], operations: [], ...(parentId ? { parentId } : {}) }) as Element;
const group = (id: string, parentId?: string): Element => ({ id, kind: 'package', name: id, ...(parentId ? { parentId } : {}) }) as Element;
const marker = (id: string): Element =>
  ({ id, kind: 'drawing', name: id, highlighter: true, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], strokeColor: '#facc15', strokeWidth: 14 }) as Element;

describe('drawOrder', () => {
  it('pone los grupos primero, luego los marcadores y después el resto en orden de array', () => {
    const elements = [cls('f1'), marker('m1'), group('g1'), cls('f2'), marker('m2')];
    expect(drawOrder(elements).map((e) => e.id)).toEqual(['g1', 'm1', 'm2', 'f1', 'f2']);
  });

  it('un grupo anidado va después de su grupo padre aunque esté antes en el array', () => {
    const elements = [group('inner', 'outer'), group('outer'), cls('c', 'inner')];
    expect(drawOrder(elements).map((e) => e.id)).toEqual(['outer', 'inner', 'c']);
  });

  it('una figura suelta no se pinta detrás de otra solo por ser hija de un grupo', () => {
    const elements = [cls('dentro', 'pkg'), cls('suelta'), group('pkg')];
    expect(drawOrder(elements).map((e) => e.id)).toEqual(['pkg', 'dentro', 'suelta']);
  });
});
