import { type Diagram, RELATION_KINDS, type Relation, type RelationKind } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { describe, expect, it } from 'vitest';
import { alignBoxes } from '../../../src/canvas/align';
import { connectionRelation, freeId, insertWaypoint, kindChanges, relationId, relationKinds, reverseChanges, segmentMidpoints } from '../../../src/canvas/edge-edits';

const diagram = {
  elements: [{ id: 'Libro', kind: 'class' as const, name: 'Libro', attributes: [], operations: [] }],
  relations: [{ id: 'r1', kind: 'association' as const, source: 'Libro', target: 'Libro' }],
};

describe('ediciones de flechas', () => {
  it('ids libres para copias y relaciones nuevas', () => {
    expect(freeId(diagram, 'Autor')).toBe('Autor');
    expect(freeId(diagram, 'Libro')).toBe('Libro2');
    expect(relationId(diagram)).toBe('r2');
  });

  it('cambiar el tipo quita multiplicidades y navegabilidad que el tipo nuevo no admite', () => {
    const rel = { id: 'r', kind: 'association' as const, source: 'A', target: 'B', targetMultiplicity: '1', navigable: 'both' as const };
    expect(kindChanges(rel, 'dependency')).toEqual({ kind: 'dependency', targetMultiplicity: null, navigable: null });
    expect(kindChanges(rel, 'composition')).toEqual({ kind: 'composition', navigable: null });
  });

  it('pasar de un conector a otro tipo quita puntas y trazo', () => {
    const rel = { id: 'r', kind: 'connector' as const, source: 'A', target: 'B', arrowheads: 'both' as const, dashed: true };
    expect(kindChanges(rel, 'association')).toEqual({ kind: 'association', arrowheads: null, dashed: null });
    expect(kindChanges(rel, 'connector')).toEqual({ kind: 'connector' });
  });

  it('pasar de c4-rel a otro tipo quita technology', () => {
    const rel = { id: 'r', kind: 'c4-rel' as const, source: 'A', target: 'B', technology: 'HTTPS' };
    expect(kindChanges(rel, 'connector')).toEqual({ kind: 'connector', technology: null });
    expect(kindChanges(rel, 'c4-rel')).toEqual({ kind: 'c4-rel' });
  });

  it('pasar de er-rel a otro tipo quita cardinalidades e identifying', () => {
    const rel = { id: 'r', kind: 'er-rel' as const, source: 'A', target: 'B', sourceCardinality: 'one' as const, targetCardinality: 'one-many' as const, identifying: true };
    expect(kindChanges(rel, 'connector')).toEqual({ kind: 'connector', sourceCardinality: null, targetCardinality: null, identifying: null });
  });

  it('invertir intercambia extremos, multiplicidades, lados y quiebres', () => {
    const changes = reverseChanges({
      id: 'r', kind: 'association', source: 'A', target: 'B', targetMultiplicity: '0..*', sourceSide: 'left',
      waypoints: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    });
    expect(changes).toEqual({
      source: 'B', target: 'A', sourceMultiplicity: '0..*', targetMultiplicity: null, sourceSide: null, targetSide: 'left',
      waypoints: [{ x: 2, y: 2 }, { x: 1, y: 1 }],
    });
  });

  it('un quiebre nuevo se ordena según el tramo de la ruta donde se arrastró', () => {
    const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
    expect(segmentMidpoints(route)).toEqual([{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 150, y: 100 }]);
    const existing = [{ x: 100, y: 100 }];
    expect(insertWaypoint(route, existing, 0, { x: 50, y: -40 })).toEqual([{ x: 50, y: -40 }, { x: 100, y: 100 }]);
    expect(insertWaypoint(route, existing, 2, { x: 150, y: 140 })).toEqual([{ x: 100, y: 100 }, { x: 150, y: 140 }]);
  });
});

describe('conectar arrastrando', () => {
  const er = {
    type: 'er' as const,
    elements: [
      { id: 'E', kind: 'entity' as const, name: 'E' },
      { id: 'F', kind: 'entity' as const, name: 'F' },
      { id: 'a', kind: 'attribute' as const, name: 'a' },
      { id: 'b', kind: 'attribute' as const, name: 'b' },
      { id: 'L', kind: 'value-list' as const, name: 'L', values: ['x'] },
    ],
    relations: [],
  };

  it('entre dos entidades crea una er-rel con cardinalidades', () => {
    expect(connectionRelation(er, 'E', 'F')).toEqual({ id: 'r1', kind: 'er-rel', source: 'E', target: 'F', sourceCardinality: 'one', targetCardinality: 'zero-many' });
  });

  it('con un atributo o lista crea una er-attr con el dueño como origen', () => {
    expect(connectionRelation(er, 'E', 'a')).toEqual({ id: 'r1', kind: 'er-attr', source: 'E', target: 'a' });
    expect(connectionRelation(er, 'a', 'E')).toEqual({ id: 'r1', kind: 'er-attr', source: 'E', target: 'a' });
    expect(connectionRelation(er, 'a', 'b')).toMatchObject({ source: 'a', target: 'b' });
    expect(connectionRelation(er, 'L', 'a')).toMatchObject({ source: 'a', target: 'L' });
  });

  it('con una figura en er crea un conector', () => {
    const withFigure = { ...er, elements: [...er.elements, { id: 'f', kind: 'figure' as const, name: 'f', shape: 'circle' as const }] };
    expect(connectionRelation(withFigure, 'E', 'f')).toEqual({ id: 'r1', kind: 'connector', source: 'E', target: 'f' });
    expect(connectionRelation(withFigure, 'f', 'a')).toMatchObject({ kind: 'connector' });
  });

  it('en clases y C4 mantiene el tipo por defecto', () => {
    expect(connectionRelation(diagram, 'Libro', 'Libro').kind).toBe('association');
    const c4 = {
      type: 'c4-context' as const,
      elements: [
        { id: 'A', kind: 'person' as const, name: 'A' },
        { id: 'B', kind: 'software-system' as const, name: 'B' },
      ],
      relations: [],
    };
    expect(connectionRelation(c4, 'A', 'B').kind).toBe('c4-rel');
  });

  it('en er crea un conector entre pares que ninguna relación semántica admite', () => {
    const withTable = { ...er, elements: [...er.elements, { id: 'T', kind: 'table' as const, name: 'T', columns: [] }] };
    expect(connectionRelation(withTable, 'a', 'T')).toEqual({ id: 'r1', kind: 'connector', source: 'a', target: 'T' });
    expect(connectionRelation(withTable, 'T', 'a')).toMatchObject({ kind: 'connector' });
    expect(connectionRelation(withTable, 'L', 'E')).toMatchObject({ kind: 'connector' });
    expect(connectionRelation(withTable, 'E', 'T')).toMatchObject({ kind: 'er-rel' });
  });

  it('en un diagrama mixto une cada par con su familia y deja el conector para cruzar familias', () => {
    const mixed = { elements: [...er.elements, { id: 'Socio', kind: 'class' as const, name: 'Socio', attributes: [], operations: [] }, { id: 'P', kind: 'person' as const, name: 'P' }], relations: [] };
    expect(connectionRelation(mixed, 'Socio', 'Socio')).toMatchObject({ kind: 'association' });
    expect(connectionRelation(mixed, 'P', 'P')).toMatchObject({ kind: 'c4-rel' });
    expect(connectionRelation(mixed, 'E', 'Socio')).toMatchObject({ kind: 'connector' });
  });

  it('relationKinds ofrece solo los tipos que admiten los dos extremos', () => {
    expect(relationKinds(er.elements, { id: 'r', kind: 'connector', source: 'E', target: 'F' })).toEqual(['er-rel', 'connector']);
    expect(relationKinds(er.elements, { id: 'r', kind: 'connector', source: 'E', target: 'a' })).toEqual(['er-attr', 'connector']);
  });

  it('pasar a er-rel desde er-attr agrega las cardinalidades obligatorias', () => {
    const rel = { id: 'r', kind: 'er-attr' as const, source: 'A', target: 'B' };
    expect(kindChanges(rel, 'er-rel')).toEqual({ kind: 'er-rel', sourceCardinality: 'one', targetCardinality: 'zero-many' });
  });
});

describe('alinear y repartir', () => {
  const boxes = [
    { id: 'a', x: 0, y: 0, width: 100, height: 50 },
    { id: 'b', x: 150, y: 40, width: 50, height: 50 },
    { id: 'c', x: 400, y: 10, width: 100, height: 30 },
  ];

  it('alinea por un borde o por el centro y omite lo que no se mueve', () => {
    expect(alignBoxes(boxes, 'left')).toEqual([{ id: 'b', x: 0, y: 40 }, { id: 'c', x: 0, y: 10 }]);
    expect(alignBoxes(boxes, 'bottom')).toEqual([{ id: 'a', x: 0, y: 40 }, { id: 'c', x: 400, y: 60 }]);
    expect(alignBoxes(boxes, 'middle').map((m) => m.y)).toEqual([20, 20, 30]);
  });

  it('reparte con el mismo espacio entre cajas sin mover las de los extremos', () => {
    expect(alignBoxes(boxes, 'distribute-x')).toEqual([{ id: 'b', x: 225, y: 40 }]);
    expect(alignBoxes([boxes[0]!], 'left')).toEqual([]);
  });
});

describe('cambiar el tipo de flecha produce siempre campos válidos', () => {
  const elements: Diagram['elements'] = [
    { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] },
    { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
  ];
  const diagramWith = (relation: Relation): Diagram => ({
    id: 'dg_aaaaaaaaaaaa', type: 'class', title: 'T', revision: 1, elements, relations: [relation],
  }) as Diagram;
  // Relación del tipo dado con todos los campos opcionales que ese tipo admite.
  const full = (kind: RelationKind): Relation => ({
    id: 'r', kind, source: 'A', target: 'B', label: 'x',
    ...(['association', 'aggregation', 'composition'].includes(kind) ? { sourceMultiplicity: '1', targetMultiplicity: '0..*' } : {}),
    ...(kind === 'association' ? { navigable: 'both' as const } : {}),
    ...(kind === 'c4-rel' ? { technology: 'HTTPS' } : {}),
    ...(kind === 'er-rel' ? { sourceCardinality: 'one' as const, targetCardinality: 'zero-many' as const, identifying: true } : {}),
    ...(kind === 'connector' ? { arrowheads: 'both' as const, dashed: true } : {}),
  });

  // Los pares de extremos no se evalúan aquí: solo que no sobren ni falten campos.
  const fieldErrors = (relation: Relation, kind: RelationKind) => {
    const result = applyOperations(diagramWith(relation), [{ op: 'update_relation', id: 'r', changes: kindChanges(relation, kind) }]);
    return result.ok ? [] : result.errors.filter((e) => e.code === 'FIELD_NOT_ALLOWED' || e.code === 'FIELD_REQUIRED');
  };

  for (const from of RELATION_KINDS) {
    for (const to of RELATION_KINDS) {
      it(`${from} a ${to}`, () => {
        expect(fieldErrors(full(from), to)).toEqual([]);
      });
    }
  }
});
