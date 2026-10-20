import { describe, expect, it } from 'vitest';
import { validateDiagram } from '../../../src/validation/index.js';
import { classDiagram, codes } from '../../support/fixtures.js';

describe('DUPLICATE_ID', () => {
  it('detecta ids de elemento repetidos', () => {
    const d = classDiagram();
    d.elements.push({ id: 'Libro', kind: 'class', name: 'Otro', attributes: [], operations: [] });
    const res = validateDiagram(d);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(codes(res.errors)).toContain('DUPLICATE_ID');
      expect(res.errors.find((e) => e.code === 'DUPLICATE_ID')?.path).toBe('/elements/4/id');
    }
  });

  it('un elemento y una relación no pueden compartir id', () => {
    const d = classDiagram();
    d.relations[0]!.id = 'Autor';
    const res = validateDiagram(d);
    expect(!res.ok && codes(res.errors)).toContain('DUPLICATE_ID');
  });
});

describe('UNKNOWN_REFERENCE', () => {
  it.each(['source', 'target'] as const)('relación con %s inexistente', (field) => {
    const d = classDiagram();
    d.relations[0]![field] = 'Fantasma';
    const res = validateDiagram(d);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const err = res.errors.find((e) => e.code === 'UNKNOWN_REFERENCE');
      expect(err?.path).toBe(`/relations/0/${field}`);
      expect(err?.message).toContain('Fantasma');
      expect(err?.hint).toBeTruthy();
    }
  });

  it('parentId inexistente', () => {
    const d = classDiagram();
    d.elements[1]!.parentId = 'pkg';
    const res = validateDiagram(d);
    expect(!res.ok && res.errors.map((e) => [e.code, e.path])).toContainEqual([
      'UNKNOWN_REFERENCE',
      '/elements/1/parentId',
    ]);
  });

  it('una relación no puede apuntar a otra relación', () => {
    const d = classDiagram();
    d.relations[0]!.target = 'r2';
    const res = validateDiagram(d);
    expect(!res.ok && codes(res.errors)).toContain('UNKNOWN_REFERENCE');
  });
});
