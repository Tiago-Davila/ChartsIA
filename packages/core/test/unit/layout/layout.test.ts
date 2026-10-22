import { describe, expect, it } from 'vitest';
import { layoutDiagram, relayoutDiagram, warmUpLayout } from '../../../src/layout/index.js';
import type { Diagram, DiagramInput } from '../../../src/model/index.js';
import { applyOperations } from '../../../src/operations/index.js';
import { c4ContainerDiagram, classDiagram, erDiagram } from '../../support/fixtures.js';
import { contains, edgesCrossingNodes, layoutOf, overlappingPairs } from '../../support/geometry.js';

function asDiagram(input: DiagramInput): Diagram {
  return {
    ...input,
    id: 'dg_aaaaaaaaaaaa',
    revision: 0,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  };
}

function library(): Diagram {
  const d = classDiagram();
  d.elements.push(
    { id: 'Socio', kind: 'class', name: 'Socio', attributes: [{ name: 'nombre', type: 'String', visibility: '-' }], operations: [] },
    { id: 'Prestamo', kind: 'class', name: 'Préstamo', attributes: [{ name: 'fecha', type: 'Date', visibility: '-' }], operations: [] },
    { id: 'Persona', kind: 'class', name: 'Persona', abstract: true, attributes: [], operations: [] },
  );
  d.relations.push(
    { id: 'r3', kind: 'inheritance', source: 'Socio', target: 'Persona' },
    { id: 'r4', kind: 'inheritance', source: 'Autor', target: 'Persona' },
    { id: 'r5', kind: 'composition', source: 'Socio', target: 'Prestamo', targetMultiplicity: '0..*' },
    { id: 'r6', kind: 'association', source: 'Prestamo', target: 'Libro' },
    { id: 'r7', kind: 'dependency', source: 'Prestamo', target: 'Estado' },
  );
  return asDiagram(d);
}

function grid(n: number): Diagram {
  const elements = Array.from({ length: n }, (_, i) => ({ id: `C${i}`, kind: 'class' as const, name: `Clase${i}`, attributes: [], operations: [] }));
  const relations = Array.from({ length: n - 1 }, (_, i) => ({
    id: `r${i}`, kind: 'association' as const, source: `C${i + 1}`, target: `C${Math.floor(i / 3)}`,
  }));
  return asDiagram({ type: 'class', title: 'Grande', elements, relations });
}

describe('layoutDiagram (completo)', () => {
  it('rellena layout de todos los elementos y route de todas las relaciones', async () => {
    const out = await layoutDiagram(library());
    for (const el of out.elements) expect(el.layout).toMatchObject({ x: expect.any(Number), width: expect.any(Number), pinned: false });
    for (const rel of out.relations) expect(rel.route!.length).toBeGreaterThanOrEqual(2);
  });

  it('misma entrada ⇒ mismo layout y route byte a byte', async () => {
    const a = await layoutDiagram(library());
    const b = await layoutDiagram(library());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('el orden de entrada no cambia el resultado', async () => {
    const d = library();
    const shuffled = { ...d, elements: [...d.elements].reverse(), relations: [...d.relations].reverse() };
    const a = await layoutDiagram(d);
    const b = await layoutDiagram(shuffled);
    for (const el of a.elements) expect(layoutOf(b, el.id)).toEqual(el.layout);
  });

  it('sin solapes de nodos ni aristas que atraviesen nodos', async () => {
    for (const d of [library(), asDiagram(c4ContainerDiagram()), grid(40)]) {
      const out = await layoutDiagram(d);
      expect(overlappingPairs(out)).toEqual([]);
      expect(edgesCrossingNodes(out)).toEqual([]);
    }
  });

  it('los hijos quedan dentro de su grupo', async () => {
    const out = await layoutDiagram(asDiagram(c4ContainerDiagram()));
    for (const id of ['web', 'db']) expect(contains(layoutOf(out, 'tienda'), layoutOf(out, id))).toBe(true);
    expect(contains(layoutOf(out, 'tienda'), layoutOf(out, 'cliente'))).toBe(false);
  });

  it('respeta las coordenadas enviadas por el agente y las deja fijadas', async () => {
    const d = library();
    d.elements.find((e) => e.id === 'Estado')!.layout = { x: 900, y: 40 } as never;
    const out = await layoutDiagram(d);
    expect(layoutOf(out, 'Estado')).toMatchObject({ x: 900, y: 40, pinned: true });
    expect(overlappingPairs(out)).toEqual([]);
    expect(edgesCrossingNodes(out)).toEqual([]);
  });

  it('no desvía las relaciones para esquivar trazos de anotación', async () => {
    const elements = [
      { id: 'A', kind: 'class' as const, name: 'A', attributes: [], operations: [], layout: { x: 0, y: 0, width: 100, height: 50 } },
      { id: 'B', kind: 'class' as const, name: 'B', attributes: [], operations: [], layout: { x: 300, y: 0, width: 100, height: 50 } },
    ];
    const relations = [{ id: 'r', kind: 'association' as const, source: 'A', target: 'B' }];
    const withoutDrawing = await layoutDiagram(asDiagram({ type: 'class', title: 'Sin trazo', elements, relations }));
    const withDrawing = await layoutDiagram(asDiagram({
      type: 'class', title: 'Dibujo sobre relación',
      elements: [
        ...elements,
        { id: 'Trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 1, y: 25 }, { x: 90, y: 25 }], strokeColor: '#000000', strokeWidth: 2, layout: { x: 150, y: 0 } },
      ],
      relations,
    }));
    expect(withDrawing.relations[0]!.route).toEqual(withoutDrawing.relations[0]!.route);
  });

  it('dispone 200 elementos en menos de 1 s (servidor en caliente)', async () => {
    await warmUpLayout();
    await layoutDiagram(grid(200));
    const start = performance.now();
    const out = await layoutDiagram(grid(200));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(overlappingPairs(out)).toEqual([]);
  });
});

describe('relayoutDiagram (incremental)', () => {
  async function edit(prev: Diagram, ops: unknown[]) {
    const res = applyOperations(prev, ops);
    if (!res.ok) throw new Error(JSON.stringify(res.errors));
    return relayoutDiagram(prev, res.diagram);
  }

  it('conserva las posiciones existentes al añadir un elemento', async () => {
    const prev = await layoutDiagram(library());
    const { diagram } = await edit(prev, [
      { op: 'add_element', element: { id: 'Editorial', kind: 'class', name: 'Editorial', attributes: [], operations: [] } },
      { op: 'add_relation', relation: { id: 'r8', kind: 'association', source: 'Libro', target: 'Editorial' } },
    ]);
    for (const el of prev.elements) expect(layoutOf(diagram, el.id)).toEqual(el.layout);
    expect(layoutOf(diagram, 'Editorial').width).toBeGreaterThan(0);
    expect(overlappingPairs(diagram)).toEqual([]);
    expect(edgesCrossingNodes(diagram)).toEqual([]);
  });

  it('conserva una figura cuando se dibuja una anotación encima', async () => {
    const prev = await layoutDiagram({
      ...asDiagram({ type: 'class', title: 'Dibujo', elements: [{ id: 'Clase', kind: 'class', name: 'Clase', attributes: [], operations: [] }], relations: [] }),
    });
    const before = layoutOf(prev, 'Clase');
    const added = applyOperations(prev, [{
      op: 'add_element', element: {
        id: 'Trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 1, y: 1 }, { x: 50, y: 40 }],
        strokeColor: '#000000', strokeWidth: 2, layout: { x: before.x, y: before.y },
      },
    }]);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const { diagram } = await relayoutDiagram(prev, added.diagram);
    expect(layoutOf(diagram, 'Clase')).toEqual(before);
    expect(layoutOf(diagram, 'Trazo')).toMatchObject({ x: before.x, y: before.y, pinned: true });
  });

  it('los fijados nunca se mueven; los no fijados solo si hace falta eliminar un solape', async () => {
    const prev = await layoutDiagram(library());
    const libro = layoutOf(prev, 'Libro');
    const moved = await edit(prev, [{ op: 'move_element', id: 'Socio', x: libro.x + 10, y: libro.y + 5 }]);
    const out = moved.diagram;
    expect(layoutOf(out, 'Socio')).toMatchObject({ x: libro.x + 10, y: libro.y + 5, pinned: true });
    expect(overlappingPairs(out)).toEqual([]);
    const untouched = prev.elements.filter((e) => !['Socio', 'Libro'].includes(e.id));
    for (const el of untouched) expect(layoutOf(out, el.id)).toEqual(el.layout);
  });

  it('un elemento que crece y pasa a solapar desplaza solo a lo necesario', async () => {
    const prev = await layoutDiagram(library());
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `atributoMuyLargo${i}`, type: 'String', visibility: '-' }));
    const { diagram } = await edit(prev, [{ op: 'update_element', id: 'Libro', changes: { attributes: many } }]);
    expect(overlappingPairs(diagram)).toEqual([]);
    expect(edgesCrossingNodes(diagram)).toEqual([]);
  });

  it('un elemento redimensionado conserva el tamaño elegido, pero nunca menor que su contenido', async () => {
    const prev = await layoutDiagram(library());
    const { diagram } = await edit(prev, [
      { op: 'resize_element', id: 'Libro', width: 400, height: 300 },
      { op: 'resize_element', id: 'Socio', width: 10, height: 10 },
    ]);
    expect(layoutOf(diagram, 'Libro')).toMatchObject({ width: 400, height: 300, pinned: true, resized: true });
    expect(layoutOf(diagram, 'Socio').width).toBeGreaterThan(10);
    expect(overlappingPairs(diagram)).toEqual([]);
  });

  it('la ruta respeta los lados elegidos y pasa por los quiebres', async () => {
    const prev = await layoutDiagram(library());
    const socio = layoutOf(prev, 'Socio');
    const waypoint = { x: socio.x - 60, y: socio.y - 60 };
    const { diagram } = await edit(prev, [{ op: 'update_relation', id: 'r5', changes: { sourceSide: 'left', waypoints: [waypoint] } }]);
    const route = diagram.relations.find((r) => r.id === 'r5')!.route!;
    expect(route[0]!.x).toBe(socio.x);
    const onSegment = route.slice(1).some((b, i) => {
      const a = route[i]!;
      return Math.min(a.x, b.x) <= waypoint.x && waypoint.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= waypoint.y && waypoint.y <= Math.max(a.y, b.y);
    });
    expect(onSegment).toBe(true);
  });

  it('es determinista', async () => {
    const prev = await layoutDiagram(library());
    const ops = [{ op: 'add_element', element: { id: 'X', kind: 'class', name: 'X', attributes: [], operations: [] } }];
    const a = await edit(prev, ops);
    const b = await edit(prev, ops);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('layout de diagramas er', () => {
  it('dispone las entidades sin solapes y es determinista', async () => {
    const a = await layoutDiagram(asDiagram(erDiagram()));
    const b = await layoutDiagram(asDiagram(erDiagram()));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(overlappingPairs(a)).toEqual([]);
    expect(a.relations.every((r) => (r.route?.length ?? 0) >= 2)).toBe(true);
  });

  it('el layout incremental acepta un er-rel nuevo sin mover lo fijado', async () => {
    const prev = await layoutDiagram(asDiagram(erDiagram()));
    const before = layoutOf(prev, 'cliente');
    const ops = [
      { op: 'add_element', element: { id: 'prod', kind: 'entity', name: 'Producto' } },
      { op: 'add_relation', relation: { id: 'r3', kind: 'er-rel', source: 'linea', target: 'prod', sourceCardinality: 'zero-many', targetCardinality: 'one' } },
    ];
    const res = applyOperations(prev, ops);
    if (!res.ok) throw new Error(JSON.stringify(res.errors));
    const { diagram } = await relayoutDiagram(prev, res.diagram);
    expect(layoutOf(diagram, 'cliente')).toEqual(before);
    expect(diagram.relations.find((r) => r.id === 'r3')?.route?.length).toBeGreaterThanOrEqual(2);
  });
});
