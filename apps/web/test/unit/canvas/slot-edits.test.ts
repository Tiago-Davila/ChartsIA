import { type Element } from '@chartsia/core/model';
import { describe, expect, it } from 'vitest';
import { changesForAddMember, changesForRemoveMember, changesForSlot, memberKinds, parseAttribute, parseMethod, slotValue } from '../../../src/canvas/slot-edits';

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

  it('el nombre de una figura se edita completo aunque se vea partido en líneas', () => {
    const figura: Element = { id: 'f', kind: 'figure', name: 'Servicio de autenticación', shape: 'circle' };
    expect(slotValue(figura, 'name', 'Servicio de')).toBe('Servicio de autenticación');
    expect(changesForSlot(figura, 'name', 'Otro')).toEqual({ name: 'Otro' });
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

describe('agregar y quitar miembros', () => {
  const interfaz: Element = { id: 'I', kind: 'interface', name: 'I', operations: [] };
  const enumeracion: Element = { id: 'E', kind: 'enum', name: 'E', literals: ['A'] };
  const sinPersona: Element = { id: 'p', kind: 'person', name: 'P' };

  it('cada tipo de elemento admite sus miembros', () => {
    expect(memberKinds(cls)).toEqual(['attribute', 'operation']);
    expect(memberKinds(enumeracion)).toEqual(['literal', 'attribute', 'operation']);
    expect(memberKinds(sinPersona)).toEqual([]);
  });

  it('agrega un atributo y un método válidos al final y devuelve su slot', () => {
    expect(changesForAddMember(cls, 'attribute')).toEqual({
      changes: { attributes: [{ name: 'x', type: 'int', visibility: '-', static: true }, { name: 'atributo', type: 'String', visibility: '+' }] },
      slot: 'attribute:1',
    });
    expect(changesForAddMember(cls, 'operation')).toEqual({
      changes: { operations: [{ name: 'f', parameters: [], visibility: '+', abstract: true }, { name: 'metodo', parameters: [], returnType: 'void', visibility: '+' }] },
      slot: 'operation:1',
    });
  });

  it('el nombre por defecto no se repite', () => {
    const repetida: Element = { id: 'A', kind: 'class', name: 'A', attributes: [{ name: 'atributo', visibility: '+' }, { name: 'atributo2', visibility: '+' }], operations: [] };
    expect(changesForAddMember(repetida, 'attribute')?.changes.attributes?.[2]).toMatchObject({ name: 'atributo3' });
  });

  it('una interfaz sin atributos y un enum aceptan miembros nuevos', () => {
    expect(changesForAddMember(interfaz, 'attribute')).toMatchObject({ changes: { attributes: [{ name: 'atributo' }] }, slot: 'attribute:0' });
    expect(changesForAddMember(enumeracion, 'literal')).toEqual({ changes: { literals: ['A', 'VALOR'] }, slot: 'literal:1' });
    expect(changesForAddMember(enumeracion, 'operation')).toMatchObject({ slot: 'operation:0' });
  });

  it('no agrega literales a una clase ni miembros a elementos sin ellos', () => {
    expect(changesForAddMember(cls, 'literal')).toBeUndefined();
    expect(changesForAddMember(sinPersona, 'attribute')).toBeUndefined();
  });

  it('quita un miembro dejando la lista completa de los demás', () => {
    const dos: Element = { id: 'A', kind: 'class', name: 'A', attributes: [{ name: 'a', visibility: '+' }, { name: 'b', visibility: '+' }], operations: [] };
    expect(changesForRemoveMember(dos, 'attribute:0')).toEqual({ attributes: [{ name: 'b', visibility: '+' }] });
    expect(changesForRemoveMember(cls, 'operation:0')).toEqual({ operations: [] });
    expect(changesForRemoveMember(cls, 'attribute:5')).toBeUndefined();
    expect(changesForRemoveMember(cls, 'name')).toBeUndefined();
  });

  it('una enumeración conserva al menos un literal', () => {
    expect(changesForRemoveMember(enumeracion, 'literal:0')).toBeUndefined();
    expect(changesForRemoveMember({ ...enumeracion, literals: ['A', 'B'] }, 'literal:0')).toEqual({ literals: ['B'] });
  });
});
