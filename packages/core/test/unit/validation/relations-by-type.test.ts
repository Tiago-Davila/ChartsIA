import { describe, expect, it } from 'vitest';
import { type DiagramContent } from '../../../src/model/index.js';
import { checkRelationsByType } from '../../../src/validation/index.js';

const cls = (id: string) => ({ id, kind: 'class', name: id, attributes: [], operations: [] });
const entity = (id: string) => ({ id, kind: 'entity', name: id });
const figure = (id: string) => ({ id, kind: 'figure', name: id, shape: 'circle' });

const diagram = (type: string, elements: unknown[], relations: unknown[]) => ({ type, title: 't', elements, relations }) as DiagramContent;

describe('relaciones según el tipo de diagrama', () => {
  it('class acepta las relaciones UML', () => {
    const d = diagram('class', [cls('A'), cls('B')], [{ id: 'r', kind: 'composition', source: 'A', target: 'B' }]);
    expect(checkRelationsByType(d)).toEqual([]);
  });

  it('class rechaza er-rel con el tipo y la lista permitida en el hint', () => {
    const d = diagram('class', [entity('A'), entity('B')], [{ id: 'r', kind: 'er-rel', source: 'A', target: 'B', sourceCardinality: 'one', targetCardinality: 'zero-many' }]);
    const [error] = checkRelationsByType(d);
    expect(error).toMatchObject({ code: 'RELATION_NOT_ALLOWED', path: '/relations/0/kind' });
    expect(error!.hint).toContain('association');
  });

  it('class rechaza connector entre clases y sugiere la relación propia', () => {
    const d = diagram('class', [cls('A'), cls('B')], [{ id: 'r', kind: 'connector', source: 'A', target: 'B' }]);
    const [error] = checkRelationsByType(d);
    expect(error).toMatchObject({ code: 'RELATION_NOT_ALLOWED' });
    expect(error!.hint).toContain('association');
  });

  it('connector sigue permitido con figuras', () => {
    const d = diagram('class', [cls('A'), figure('F')], [{ id: 'r', kind: 'connector', source: 'A', target: 'F' }]);
    expect(checkRelationsByType(d)).toEqual([]);
  });

  it('er rechaza connector entre entidades pero acepta el rombo Chen', () => {
    const rombo = { id: 'R', kind: 'relationship', name: 'hace' };
    const d = diagram(
      'er',
      [entity('A'), entity('B'), rombo],
      [
        { id: 'r1', kind: 'connector', source: 'A', target: 'B' },
        { id: 'r2', kind: 'connector', source: 'A', target: 'R' },
      ],
    );
    const errors = checkRelationsByType(d);
    expect(errors.map((e) => e.path)).toEqual(['/relations/0/kind']);
  });

  it('c4 solo acepta c4-rel', () => {
    const d = diagram(
      'c4-context',
      [{ id: 'P', kind: 'person', name: 'P' }, { id: 'S', kind: 'software-system', name: 'S' }],
      [{ id: 'r', kind: 'association', source: 'P', target: 'S' }],
    );
    expect(checkRelationsByType(d)).toHaveLength(1);
  });

  it('con diagrama previo solo revisa las relaciones nuevas o cambiadas', () => {
    const old = diagram('class', [entity('A'), entity('B')], [{ id: 'r', kind: 'er-rel', source: 'A', target: 'B', sourceCardinality: 'one', targetCardinality: 'one' }]);
    expect(checkRelationsByType(old)).toHaveLength(1);
    expect(checkRelationsByType(old, old)).toEqual([]);
    const changed = { ...old, relations: [{ id: 'r', kind: 'er-rel', source: 'B', target: 'A', sourceCardinality: 'one', targetCardinality: 'one' }] } as DiagramContent;
    expect(checkRelationsByType(changed, old)).toHaveLength(1);
  });
});
