import { describe, expect, it } from 'vitest';
import { type DiagramInput, ElementSchema, RelationSchema } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { classDiagram, codes, erDiagram } from '../../support/fixtures.js';

function withRelation(relation: Record<string, unknown>) {
  return validateDiagram({ ...erDiagram(), relations: [{ id: 'rx', ...relation }] } as DiagramInput);
}

function errorAt(res: ReturnType<typeof validateDiagram>, code: string) {
  return res.ok ? undefined : res.errors.find((e) => e.code === code);
}

describe('diagrama er', () => {
  it('acepta un diagrama ER válido', () => {
    expect(validateDiagram(erDiagram()).ok).toBe(true);
  });

  it('la entidad admite weak y rechaza campos de otros kinds', () => {
    expect(ElementSchema.safeParse({ id: 'E', kind: 'entity', name: 'E', weak: true }).success).toBe(true);
    expect(ElementSchema.safeParse({ id: 'E', kind: 'entity', name: 'E', attributes: [] }).success).toBe(false);
    expect(ElementSchema.safeParse({ id: 'E', kind: 'class', name: 'E', attributes: [], operations: [], weak: true }).success).toBe(false);
  });

  it('la relación solo admite las cuatro cardinalidades', () => {
    const rel = { id: 'r', kind: 'er-rel', source: 'A', target: 'B' };
    for (const c of ['one', 'zero-one', 'one-many', 'zero-many']) expect(RelationSchema.safeParse({ ...rel, sourceCardinality: c }).success).toBe(true);
    expect(RelationSchema.safeParse({ ...rel, sourceCardinality: 'many' }).success).toBe(false);
  });

  it('las cardinalidades son obligatorias en er-rel (FIELD_REQUIRED)', () => {
    const res = withRelation({ kind: 'er-rel', source: 'cliente', target: 'pedido', targetCardinality: 'one' });
    const err = errorAt(res, 'FIELD_REQUIRED');
    expect(err?.path).toBe('/relations/0/sourceCardinality');
    expect(err?.hint).toContain('zero-many');
  });

  it('er-rel no admite multiplicidades ni technology ni navigable', () => {
    const res = withRelation({
      kind: 'er-rel', source: 'cliente', target: 'pedido', sourceCardinality: 'one', targetCardinality: 'one',
      sourceMultiplicity: '1', technology: 'x', navigable: 'both',
    });
    expect(codes(res.ok ? [] : res.errors)).toEqual(['FIELD_NOT_ALLOWED', 'FIELD_NOT_ALLOWED', 'FIELD_NOT_ALLOWED']);
  });

  it('prohíbe relaciones UML y C4 en er', () => {
    for (const kind of ['association', 'inheritance', 'c4-rel']) {
      const res = withRelation({ kind, source: 'cliente', target: 'pedido' });
      expect(errorAt(res, 'RELATION_NOT_ALLOWED')?.path).toBe('/relations/0/kind');
    }
  });

  it('prohíbe kinds de clases y C4 en er', () => {
    const res = validateDiagram({ type: 'er', title: 'T', relations: [], elements: [{ id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] }] });
    expect(errorAt(res, 'KIND_NOT_ALLOWED')?.path).toBe('/elements/0/kind');
  });

  it('prohíbe entity y er-rel en class', () => {
    const base = classDiagram();
    const kind = validateDiagram({ ...base, elements: [...base.elements, { id: 'E', kind: 'entity', name: 'E' }] } as DiagramInput);
    expect(errorAt(kind, 'KIND_NOT_ALLOWED')).toBeDefined();
    const rel = validateDiagram({ ...base, relations: [{ id: 'x', kind: 'er-rel', source: 'Libro', target: 'Autor', sourceCardinality: 'one', targetCardinality: 'one' }] } as DiagramInput);
    expect(errorAt(rel, 'RELATION_NOT_ALLOWED')).toBeDefined();
  });

  it('cardinalidad e identifying fuera de er-rel dan FIELD_NOT_ALLOWED', () => {
    const base = classDiagram();
    const res = validateDiagram({ ...base, relations: [{ id: 'x', kind: 'association', source: 'Libro', target: 'Autor', sourceCardinality: 'one', identifying: true }] } as DiagramInput);
    expect(res.ok ? [] : res.errors.map((e) => e.path)).toEqual(['/relations/0/sourceCardinality', '/relations/0/identifying']);
  });
});
