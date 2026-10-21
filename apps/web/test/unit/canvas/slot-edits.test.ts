import { type Element } from '@chartsia/core/model';
import { describe, expect, it } from 'vitest';
import { changesForSlot, parseAttribute, parseMethod, slotValue } from '../../../src/canvas/slot-edits';

const cls: Element = {
  id: 'A', kind: 'class', name: 'A',
  attributes: [{ name: 'x', type: 'int', visibility: '-', static: true }],
  operations: [{ name: 'f', parameters: [], visibility: '+', abstract: true }],
};

describe('edición en línea → changes', () => {
  it.each([
    ['- isbn: String', { name: 'isbn', type: 'String', visibility: '-' }],
    ['# total: int = 0', { name: 'total', type: 'int', visibility: '#', defaultValue: '0' }],
    ['nombre', { name: 'nombre', visibility: '+' }],
  ])('parseAttribute(%s)', (text, expected) => {
    expect(parseAttribute(text)).toEqual(expected);
  });

  it('parseMethod con parámetros y retorno', () => {
    expect(parseMethod('~ pagar(monto: Decimal, nota): boolean')).toEqual({
      name: 'pagar', visibility: '~', returnType: 'boolean', parameters: [{ name: 'monto', type: 'Decimal' }, { name: 'nota' }],
    });
    expect(parseMethod('sin paréntesis')).toBeUndefined();
  });

  it('conserva static y abstract del miembro editado', () => {
    expect(changesForSlot(cls, 'attribute:0', '+ y: long')).toEqual({ attributes: [{ name: 'y', type: 'long', visibility: '+', static: true }] });
    expect(changesForSlot(cls, 'operation:0', '+ g()')).toEqual({ operations: [{ name: 'g', parameters: [], visibility: '+', abstract: true }] });
  });

  it('parseMethod lee y conserva el prefijo default', () => {
    expect(parseMethod('+ default describir(): String')).toEqual({ name: 'describir', visibility: '+', returnType: 'String', parameters: [], default: true });
    expect(parseMethod('+ describir()')).not.toHaveProperty('default');
  });

  it('nombre, literales, descripción y tecnología', () => {
    expect(changesForSlot(cls, 'name', 'B')).toEqual({ name: 'B' });
    expect(changesForSlot({ id: 'E', kind: 'enum', name: 'E', literals: ['A', 'B'] }, 'literal:1', 'C')).toEqual({ literals: ['A', 'C'] });
    const c4: Element = { id: 'w', kind: 'container', name: 'Web', technology: 'React', description: 'Texto largo' };
    expect(slotValue(c4, 'type', '[Container: React]')).toBe('React');
    expect(slotValue(c4, 'description', 'Texto…')).toBe('Texto largo');
    expect(changesForSlot(c4, 'type', 'Vue')).toEqual({ technology: 'Vue' });
  });

  it('edita un valor de una lista de valores y su nombre', () => {
    const list: Element = { id: 'L', kind: 'value-list', name: 'L', values: ['a', 'b'] };
    expect(changesForSlot(list, 'value:1', 'c')).toEqual({ values: ['a', 'c'] });
    expect(changesForSlot(list, 'name', 'Estados')).toEqual({ name: 'Estados' });
    expect(changesForSlot(cls, 'value:0', 'x')).toBeUndefined();
  });

  it('slots desconocidos o texto inválido ⇒ sin cambios', () => {
    expect(changesForSlot(cls, 'label', 'x')).toBeUndefined();
    expect(changesForSlot(cls, 'operation:0', 'sin paréntesis')).toBeUndefined();
  });
});
