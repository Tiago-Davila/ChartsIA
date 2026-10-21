import { describe, expect, it } from 'vitest';
import { applyOperations } from '../../../src/operations/index.js';
import { type DiagramInput, ElementSchema } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { codes } from '../../support/fixtures.js';

const attr = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'attribute', name: id, ...extra });
const link = (id: string, source: string, target: string) => ({ id, kind: 'er-attr', source, target });

function chen(elements: unknown[], relations: unknown[]) {
  return validateDiagram({
    type: 'er',
    title: 'Chen',
    elements: [{ id: 'cliente', kind: 'entity', name: 'Cliente' }, { id: 'pedido', kind: 'entity', name: 'Pedido' }, ...elements],
    relations,
  } as DiagramInput);
}

function errors(res: ReturnType<typeof validateDiagram>) {
  return res.ok ? [] : res.errors;
}

describe('atributos Chen', () => {
  it('acepta clave, multivaluado, derivado, compuesto y lista de valores', () => {
    const res = chen(
      [
        attr('dni', { key: true }),
        attr('tel', { multivalued: true }),
        attr('edad', { derived: true }),
        attr('nombre'),
        attr('pila'),
        { id: 'estados', kind: 'value-list', name: 'Estados', values: ['a', 'b'] },
      ],
      [link('a1', 'cliente', 'dni'), link('a2', 'cliente', 'tel'), link('a3', 'cliente', 'edad'), link('a4', 'cliente', 'nombre'), link('a5', 'nombre', 'pila'), link('a6', 'pila', 'estados')],
    );
    expect(errors(res)).toEqual([]);
  });

  it('los esquemas rechazan campos de otros kinds y listas vacías', () => {
    expect(ElementSchema.safeParse(attr('a', { weak: true })).success).toBe(false);
    expect(ElementSchema.safeParse(attr('a', { values: ['x'] })).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'L', kind: 'value-list', name: 'L', values: [] }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'L', kind: 'value-list', name: 'L' }).success).toBe(false);
  });

  it('una clave no puede ser multivaluada ni derivada', () => {
    const res = chen([attr('dni', { key: true, multivalued: true, derived: true })], [link('a1', 'cliente', 'dni')]);
    expect(errors(res).map((e) => [e.code, e.path])).toEqual([
      ['FIELD_NOT_ALLOWED', '/elements/2/multivalued'],
      ['FIELD_NOT_ALLOWED', '/elements/2/derived'],
    ]);
  });

  it('la lista de valores no repite valores (INVALID_MEMBER)', () => {
    const res = chen([attr('e'), { id: 'L', kind: 'value-list', name: 'L', values: ['a', 'b', 'a'] }], [link('a1', 'cliente', 'e'), link('a2', 'e', 'L')]);
    expect(errors(res)).toMatchObject([{ code: 'INVALID_MEMBER', path: '/elements/3/values/2' }]);
  });
});

describe('er-attr: a qué se puede unir', () => {
  const base = [attr('a'), attr('b'), { id: 'L', kind: 'value-list', name: 'L', values: ['x'] }, { id: 'T', kind: 'table', name: 'T', columns: [{ name: 'id', type: 'INT' }] }];

  it.each([
    ['entity → attribute', 'cliente', 'a', true],
    ['attribute → attribute', 'a', 'b', true],
    ['attribute → value-list', 'a', 'L', true],
    ['attribute → entity', 'a', 'cliente', false],
    ['entity → entity', 'cliente', 'pedido', false],
    ['entity → value-list', 'cliente', 'L', false],
    ['value-list → attribute', 'L', 'a', false],
    ['table → attribute', 'T', 'a', false],
  ])('%s', (_, source, target, ok) => {
    const res = chen(base, [link('a1', source as string, target as string)]);
    if (ok) expect(errors(res)).toEqual([]);
    else expect(errors(res)).toMatchObject([{ code: 'RELATION_NOT_ALLOWED', path: '/relations/0/kind' }]);
  });

  it('el hint explica la dirección del dueño al elemento que cuelga', () => {
    const err = errors(chen(base, [link('a1', 'a', 'cliente')]))[0];
    expect(err?.hint).toContain('entity→attribute');
  });

  it('er-rel no une atributos ni listas', () => {
    const rel = { id: 'r1', kind: 'er-rel', source: 'cliente', target: 'a', sourceCardinality: 'one', targetCardinality: 'one' };
    expect(errors(chen(base, [rel]))).toMatchObject([{ code: 'RELATION_NOT_ALLOWED', path: '/relations/0/kind' }]);
  });

  it('er-attr no admite cardinalidades ni identifying', () => {
    const res = chen(base, [{ ...link('a1', 'cliente', 'a'), sourceCardinality: 'one', identifying: true }]);
    expect(codes(errors(res))).toEqual(['FIELD_NOT_ALLOWED', 'FIELD_NOT_ALLOWED']);
  });

  it('solo existe en diagramas er', () => {
    const res = validateDiagram({ type: 'class', title: 'C', elements: [{ id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] }, { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] }], relations: [link('a1', 'A', 'B')] } as DiagramInput);
    expect(errors(res)).toMatchObject([{ code: 'RELATION_NOT_ALLOWED', path: '/relations/0/kind' }]);
  });

  it('un atributo no puede colgar de dos dueños', () => {
    const res = chen([attr('a')], [link('a1', 'cliente', 'a'), link('a2', 'pedido', 'a')]);
    expect(errors(res)).toMatchObject([{ code: 'RELATION_NOT_ALLOWED', path: '/relations/1/target' }]);
  });

  it('un atributo compuesto no puede colgar de sus sub-atributos (ciclo)', () => {
    const res = chen([attr('a'), attr('b')], [link('a1', 'cliente', 'a'), link('a2', 'a', 'b'), link('a3', 'b', 'a')]);
    expect(codes(errors(res))).toContain('RELATION_NOT_ALLOWED');
    const self = chen([attr('a')], [link('a1', 'a', 'a')]);
    expect(errors(self)).toMatchObject([{ code: 'RELATION_NOT_ALLOWED', path: '/relations/0' }]);
  });
});

describe('operaciones sobre atributos', () => {
  it('update_element cambia las marcas y un lote que rompe una regla no se aplica', () => {
    const diagram = chen([attr('dni')], [link('a1', 'cliente', 'dni')]);
    expect(diagram.ok).toBe(true);
    if (!diagram.ok) return;
    const full = { ...diagram.value, id: 'dg_aaaaaaaaaaaa', revision: 1, createdAt: 'x', updatedAt: 'x' };
    const ok = applyOperations(full, [{ op: 'update_element', id: 'dni', changes: { key: true } }]);
    expect(ok.ok).toBe(true);
    const bad = applyOperations(full, [{ op: 'update_element', id: 'dni', changes: { key: true, derived: true } }]);
    expect(bad.ok).toBe(false);
  });
});
