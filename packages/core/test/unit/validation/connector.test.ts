import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPES, type DiagramInput } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { codes } from '../../support/fixtures.js';

const elements = [
  { id: 'a', kind: 'figure', name: 'A', shape: 'circle' },
  { id: 'b', kind: 'figure', name: 'B', shape: 'cloud' },
];

function diagram(type: string, relation: Record<string, unknown>, extra: Record<string, unknown>[] = []) {
  return validateDiagram({ type, title: 'T', elements: [...elements, ...extra], relations: [{ id: 'r', source: 'a', target: 'b', ...relation }] } as DiagramInput);
}

describe('relación connector', () => {
  it.each(DIAGRAM_TYPES)('se permite entre figuras en un diagrama %s', (type) => {
    expect(diagram(type, { kind: 'connector', arrowheads: 'both', dashed: true, label: 'une' }).ok).toBe(true);
  });

  it('no necesita ni arrowheads ni dashed', () => {
    expect(diagram('class', { kind: 'connector' }).ok).toBe(true);
  });

  it('une una figura con una entity, una table y un attribute de er', () => {
    const extra = [
      { id: 'e', kind: 'entity', name: 'E' },
      { id: 't', kind: 'table', name: 'T', columns: [{ name: 'id', type: 'INT', pk: true }] },
      { id: 'at', kind: 'attribute', name: 'at' },
    ];
    for (const target of ['e', 't', 'at']) expect(diagram('er', { kind: 'connector', target }, extra).ok).toBe(true);
  });

  it('no admite grupos como extremo', () => {
    const res = diagram('class', { kind: 'connector', target: 'p' }, [{ id: 'p', kind: 'package', name: 'p' }]);
    expect(res.ok ? [] : codes(res.errors)).toContain('RELATION_NOT_ALLOWED');
  });

  it('rechaza un valor de puntas desconocido', () => {
    const res = diagram('class', { kind: 'connector', arrowheads: 'start' });
    expect(res.ok ? [] : codes(res.errors)).toContain('SCHEMA_VIOLATION');
  });

  it('rechaza cardinalidades y multiplicidades', () => {
    const res = diagram('er', { kind: 'connector', sourceCardinality: 'one', targetMultiplicity: '1' });
    expect(res.ok).toBe(false);
    expect(res.ok ? [] : res.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['/relations/0/sourceCardinality', '/relations/0/targetMultiplicity']));
  });

  it.each(['arrowheads', 'dashed'])('%s solo aplica a connector', (field) => {
    const res = diagram('class', { kind: 'dependency', [field]: field === 'dashed' ? true : 'end' });
    expect(res.ok ? undefined : res.errors.find((e) => e.code === 'FIELD_NOT_ALLOWED')?.path).toBe(`/relations/0/${field}`);
  });

  it('las demás relaciones siguen sin admitir figuras en er', () => {
    const res = diagram('er', { kind: 'er-rel', sourceCardinality: 'one', targetCardinality: 'one' });
    expect(res.ok ? [] : codes(res.errors)).toContain('RELATION_NOT_ALLOWED');
  });
});
