import { describe, expect, it } from 'vitest';
import { validateDiagram } from '../../../src/validation/index.js';

const base = {
  type: 'nosql',
  title: 'Pedidos',
  elements: [{ id: 'Pedidos', kind: 'collection', name: 'pedidos', fields: [] }],
  relations: [],
};

describe('validación de campos NoSQL', () => {
  it('rechaza rutas duplicadas con path al campo repetido', () => {
    const result = validateDiagram({
      ...base,
      elements: [{ ...base.elements[0], fields: [
        { path: ['cliente'], type: 'object' },
        { path: ['cliente'], type: 'object' },
      ] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_NOSQL_FIELD', path: '/elements/0/fields/1/path' }));
  });

  it('exige un padre object existente para los campos anidados', () => {
    const result = validateDiagram({
      ...base,
      elements: [{ ...base.elements[0], fields: [{ path: ['cliente', 'nombre'], type: 'string' }] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ code: 'INVALID_NOSQL_FIELD', path: '/elements/0/fields/0/path' });
  });

  it('no permite hijos bajo un campo simple ni bajo arrays de escalares', () => {
    for (const parent of [
      { path: ['cliente'], type: 'string' },
      { path: ['direcciones'], type: 'array', itemsType: 'string' },
    ]) {
      const result = validateDiagram({
        ...base,
        elements: [{ ...base.elements[0], fields: [parent, { path: [...parent.path, 'calle'], type: 'string' }] }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ code: 'INVALID_NOSQL_FIELD', path: '/elements/0/fields/1/path' }));
    }
  });

  it('permite referencias solo entre colecciones', () => {
    const valid = validateDiagram({
      type: 'nosql',
      title: 'Referencias',
      elements: [
        { id: 'A', kind: 'collection', name: 'pedidos', fields: [] },
        { id: 'B', kind: 'collection', name: 'clientes', fields: [] },
      ],
      relations: [{ id: 'r1', kind: 'nosql-rel', source: 'A', target: 'B' }],
    });
    expect(valid.ok).toBe(true);

    const invalid = validateDiagram({
      type: 'nosql',
      title: 'Referencias',
      elements: [
        { id: 'A', kind: 'collection', name: 'pedidos', fields: [] },
        { id: 'B', kind: 'figure', name: 'Figura', shape: 'circle' },
      ],
      relations: [{ id: 'r1', kind: 'nosql-rel', source: 'A', target: 'B' }],
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.errors).toContainEqual(expect.objectContaining({ code: 'RELATION_NOT_ALLOWED', path: '/relations/0/kind' }));
  });
});
