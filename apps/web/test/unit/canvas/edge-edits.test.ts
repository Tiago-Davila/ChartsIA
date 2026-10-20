import { describe, expect, it } from 'vitest';
import { alignBoxes } from '../../../src/canvas/align';
import { freeId, insertWaypoint, kindChanges, relationId, reverseChanges, segmentMidpoints } from '../../../src/canvas/edge-edits';

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
    expect(kindChanges(rel, 'dependency')).toEqual({ kind: 'dependency', sourceMultiplicity: null, targetMultiplicity: null, navigable: null });
    expect(kindChanges(rel, 'composition')).toEqual({ kind: 'composition', navigable: null });
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
