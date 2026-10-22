import { describe, expect, it } from 'vitest';
import type { Diagram } from '../../../src/model/index.js';
import { DiagramSchema, DiagramInputSchema } from '../../../src/model/index.js';
import { applyOperations } from '../../../src/operations/index.js';
import { codes } from '../../support/fixtures.js';
import { pngDataUrl } from '../../support/images.js';

function base(): Diagram {
  return {
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title: 'Biblioteca',
    revision: 3,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    elements: [
      { id: 'pkg', kind: 'package', name: 'dominio' },
      { id: 'sub', kind: 'package', name: 'prestamos', parentId: 'pkg' },
      { id: 'Libro', kind: 'class', name: 'Libro', attributes: [], operations: [], parentId: 'sub' },
      { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [], parentId: 'sub' },
      { id: 'Socio', kind: 'class', name: 'Socio', attributes: [], operations: [],
        layout: { x: 10, y: 20, width: 100, height: 50, pinned: false } },
    ],
    relations: [
      { id: 'r1', kind: 'association', source: 'Libro', target: 'Autor' },
      { id: 'r2', kind: 'association', source: 'Socio', target: 'Libro', label: 'presta' },
    ],
  };
}

const apply = (ops: unknown[], d = base()) => applyOperations(d, ops);
const ids = (d: Diagram) => [d.elements.map((e) => e.id), d.relations.map((r) => r.id)];

describe('applyOperations', () => {
  it('aplica el lote en orden y no muta la entrada', () => {
    const d = base();
    const res = apply(
      [
        { op: 'add_element', element: { id: 'Editorial', kind: 'class', name: 'Editorial', attributes: [], operations: [] } },
        { op: 'add_relation', relation: { id: 'r3', kind: 'association', source: 'Libro', target: 'Editorial' } },
        { op: 'set_title', title: 'Biblioteca v2' },
      ],
      d,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.applied).toBe(3);
      expect(res.diagram.title).toBe('Biblioteca v2');
      expect(ids(res.diagram)[0]).toContain('Editorial');
      expect(ids(res.diagram)[1]).toContain('r3');
    }
    expect(d).toEqual(base());
  });

  it('es atómico: un error en cualquier operación rechaza el lote entero', () => {
    const res = apply([
      { op: 'set_title', title: 'Nuevo' },
      { op: 'add_relation', relation: { id: 'r9', kind: 'association', source: 'Libro', target: 'Nadie' } },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(codes(res.errors)).toEqual(['UNKNOWN_REFERENCE']);
  });

  it.each([[[]], [Array(201).fill({ op: 'set_title', title: 'x' })]])('lote vacío o > 200 ⇒ SCHEMA_VIOLATION', (ops) => {
    const res = apply(ops);
    expect(!res.ok && codes(res.errors)).toContain('SCHEMA_VIOLATION');
  });

  it('remove_element elimina en cascada sus relaciones', () => {
    const res = apply([{ op: 'remove_element', id: 'Libro' }]);
    expect(res.ok && ids(res.diagram)).toEqual([['pkg', 'sub', 'Autor', 'Socio'], []]);
  });

  it('grupo con reparent (defecto) reasigna los hijos al padre del grupo', () => {
    const res = apply([{ op: 'remove_element', id: 'sub' }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.diagram.elements.find((e) => e.id === 'Libro')?.parentId).toBe('pkg');
      expect(res.diagram.relations).toHaveLength(2);
    }
    const top = apply([{ op: 'remove_element', id: 'pkg', cascade: 'reparent' }]);
    expect(top.ok && top.diagram.elements.find((e) => e.id === 'sub')?.parentId).toBeUndefined();
  });

  it('cascade: "children" elimina descendientes y sus relaciones', () => {
    const res = apply([{ op: 'remove_element', id: 'pkg', cascade: 'children' }]);
    expect(res.ok && ids(res.diagram)).toEqual([['Socio'], []]);
  });

  it('reparent que deja un component fuera de un boundary container ⇒ INVALID_PARENT con hint', () => {
    const c4: Diagram = {
      ...base(),
      type: 'c4-component',
      elements: [
        { id: 'api', kind: 'boundary', name: 'API', boundaryType: 'container' },
        { id: 'ctrl', kind: 'component', name: 'Controller', parentId: 'api' },
      ],
      relations: [],
    };
    const res = apply([{ op: 'remove_element', id: 'api' }], c4);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const err = res.errors.find((e) => e.code === 'INVALID_PARENT');
      expect(err?.hint).toMatch(/cascade: "children"/);
    }
    expect(apply([{ op: 'remove_element', id: 'api', cascade: 'children' }], c4).ok).toBe(true);
  });

  it('add_element con layout {x,y} ⇒ fijado', () => {
    const res = apply([
      { op: 'add_element', element: { id: 'Nuevo', kind: 'class', name: 'Nuevo', attributes: [], operations: [], layout: { x: 300, y: 40 } } },
    ]);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'Nuevo')?.layout).toMatchObject({ x: 300, y: 40, pinned: true });
  });

  it('move_element marca pinned=true y conserva el tamaño', () => {
    const res = apply([{ op: 'move_element', id: 'Socio', x: 500, y: 600 }]);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'Socio')?.layout).toEqual({
      x: 500, y: 600, width: 100, height: 50, pinned: true,
    });
  });

  it('move_element de un grupo desplaza a sus descendientes', () => {
    const d = base();
    d.elements[1]!.layout = { x: 100, y: 100, width: 300, height: 200, pinned: false };
    d.elements[2]!.layout = { x: 120, y: 130, width: 100, height: 50, pinned: false };
    const res = apply([{ op: 'move_element', id: 'sub', x: 150, y: 90 }], d);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'Libro')?.layout).toMatchObject({ x: 170, y: 120 });
  });

  it('mover un frame desplaza una sola vez sus hijos anidados y desagrupar conserva coordenadas', () => {
    const d: Diagram = {
      ...base(),
      elements: [
        { id: 'outer', kind: 'frame', name: 'Exterior', layout: { x: 100, y: 100, width: 400, height: 300, pinned: false } },
        { id: 'inner', kind: 'frame', name: 'Interior', parentId: 'outer', layout: { x: 140, y: 150, width: 200, height: 150, pinned: false } },
        { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [], parentId: 'inner', layout: { x: 160, y: 180, width: 80, height: 40, pinned: false } },
        { id: 'logo', kind: 'figure', name: 'Logo', shape: 'circle', parentId: 'outer', layout: { x: 120, y: 130, width: 30, height: 30, pinned: false } },
      ],
      relations: [],
    };
    const moved = apply([{ op: 'move_element', id: 'outer', x: 120, y: 130 }], d);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.diagram.elements.map(({ id, layout }) => [id, layout?.x, layout?.y])).toEqual([
      ['outer', 120, 130], ['inner', 160, 180], ['A', 180, 210], ['logo', 140, 160],
    ]);
    const ungrouped = apply([{ op: 'remove_element', id: 'outer', cascade: 'reparent' }], moved.diagram);
    expect(ungrouped.ok).toBe(true);
    if (!ungrouped.ok) return;
    const inner = ungrouped.diagram.elements.find((e) => e.id === 'inner')!;
    expect(inner).not.toHaveProperty('parentId');
    expect(inner).toMatchObject({ layout: { x: 160, y: 180 } });
    expect(ungrouped.diagram.elements.find((e) => e.id === 'A')).toMatchObject({ parentId: 'inner', layout: { x: 180, y: 210 } });
    expect(ungrouped.diagram.elements.find((e) => e.id === 'logo')).toMatchObject({ layout: { x: 140, y: 160 } });
  });

  it('update_element cambia campos, null elimina opcionales y no admite id/kind', () => {
    const res = apply([
      { op: 'update_element', id: 'Libro', changes: { name: 'Ejemplar', parentId: null, description: 'Copia física' } },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const el = res.diagram.elements.find((e) => e.id === 'Libro');
      expect(el).toMatchObject({ name: 'Ejemplar', description: 'Copia física' });
      expect(el).not.toHaveProperty('parentId');
    }
    for (const changes of [{ id: 'X' }, { kind: 'interface' }]) {
      const bad = apply([{ op: 'update_element', id: 'Libro', changes }]);
      expect(!bad.ok && codes(bad.errors)).toContain('SCHEMA_VIOLATION');
    }
  });

  it('update_element rechaza campos que el kind no admite', () => {
    const res = apply([{ op: 'update_element', id: 'Libro', changes: { technology: 'Java' } }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toMatchObject({ code: 'FIELD_NOT_ALLOWED', path: '/operations/0/changes/technology' });
  });

  it('resize_element fija el elemento, guarda el tamaño y lo marca como redimensionado', () => {
    const res = apply([{ op: 'resize_element', id: 'Socio', width: 300, height: 120 }]);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'Socio')?.layout).toEqual({ x: 10, y: 20, width: 300, height: 120, pinned: true, resized: true });
    expect(apply([{ op: 'resize_element', id: 'Socio', width: 0, height: 10 }]).ok).toBe(false);
  });

  it('update_relation cambia el tipo, invierte, fija lados y quiebres', () => {
    const res = apply([
      { op: 'update_relation', id: 'r2', changes: { kind: 'dependency', source: 'Libro', target: 'Socio', sourceSide: 'left', waypoints: [{ x: 1, y: 2 }] } },
    ]);
    expect(res.ok && res.diagram.relations[1]).toMatchObject({ kind: 'dependency', source: 'Libro', target: 'Socio', sourceSide: 'left', waypoints: [{ x: 1, y: 2 }] });
    const cleared = apply([{ op: 'update_relation', id: 'r2', changes: { sourceSide: null, waypoints: null } }], res.ok ? res.diagram : base());
    expect(cleared.ok && cleared.diagram.relations[1]).not.toHaveProperty('waypoints');
    expect(apply([{ op: 'update_relation', id: 'r2', changes: { kind: 'c4-rel' } }]).ok).toBe(false);
  });

  it('update_relation y remove_relation', () => {
    const res = apply([
      { op: 'update_relation', id: 'r2', changes: { label: null, targetMultiplicity: '0..*' } },
      { op: 'remove_relation', id: 'r1' },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.diagram.relations).toEqual([{ id: 'r2', kind: 'association', source: 'Socio', target: 'Libro', targetMultiplicity: '0..*' }]);
    }
  });

  it.each([
    [{ op: 'update_element', id: 'Nadie', changes: { name: 'x' } }],
    [{ op: 'remove_element', id: 'Nadie' }],
    [{ op: 'move_element', id: 'Nadie', x: 0, y: 0 }],
    [{ op: 'update_relation', id: 'rx', changes: { label: 'x' } }],
    [{ op: 'remove_relation', id: 'rx' }],
  ])('id inexistente ⇒ UNKNOWN_REFERENCE (%o)', (op) => {
    const res = apply([op]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toMatchObject({ code: 'UNKNOWN_REFERENCE', path: '/operations/0/id' });
  });

  it('set_title fuera de 1–120 chars y set_style (retirado) ⇒ error', () => {
    for (const op of [
      { op: 'set_title', title: '' },
      { op: 'set_title', title: 'x'.repeat(121) },
      { op: 'set_style', style: 'sketch' },
    ]) {
      const res = apply([op]);
      expect(!res.ok && res.errors[0]?.path).toMatch(/^\/operations\/0/);
    }
  });

  it('valida las reglas de dominio sobre el resultado', () => {
    const res = apply([{ op: 'add_element', element: { id: 'C', kind: 'component', name: 'C' } }]);
    expect(!res.ok && codes(res.errors)).toEqual(['INVALID_PARENT']);
  });

  it('respeta el máximo de elementos', () => {
    const res = applyOperations(base(), [{ op: 'add_element', element: { id: 'X', kind: 'package', name: 'X' } }], { maxElements: 5 });
    expect(!res.ok && codes(res.errors)).toEqual(['LIMIT_EXCEEDED']);
  });

  it('rechaza de forma atómica el presupuesto de imágenes acumulado al crear y actualizar', () => {
    const usual = pngDataUrl({ ancillaryBytes: Math.floor(4.3 * 1024 * 1024) });
    const replacement = pngDataUrl({ ancillaryBytes: Math.floor(4.9 * 1024 * 1024) });
    const images = Array.from({ length: 6 }, (_, index) => ({ id: `img${index}`, kind: 'image', name: `Imagen ${index}`, src: usual }));
    expect(DiagramInputSchema.safeParse({ type: 'class', title: 'Imágenes', elements: images, relations: [] }).success).toBe(false);

    const before = DiagramSchema.parse({
      ...base(),
      elements: images.slice(0, 5),
    });
    const result = applyOperations(before, [
      { op: 'set_title', title: 'Debe ser atómico' },
      { op: 'update_element', id: 'img0', changes: { src: replacement } },
      { op: 'add_element', element: images[5] },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ code: 'LIMIT_EXCEEDED', message: expect.stringContaining('25 MiB') }));
    expect(before.title).toBe('Biblioteca');
    expect(before.elements[0]?.kind).toBe('image');
    if (before.elements[0]?.kind === 'image') expect(before.elements[0].src).toBe(usual);
  }, 30_000);

  it('rechaza el presupuesto acumulado de píxeles raster en una operación', () => {
    const before = DiagramSchema.parse({
      ...base(),
      elements: [{ id: 'img0', kind: 'image', name: 'Imagen 0', src: pngDataUrl({ width: 7_000, height: 4_000 }) }],
    });
    const next = { id: 'img1', kind: 'image', name: 'Imagen 1', src: pngDataUrl({ width: 4_000, height: 4_000 }) };
    const result = applyOperations(before, [{ op: 'add_element', element: next }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ code: 'LIMIT_EXCEEDED', message: expect.stringContaining('40 millones') }));
  });

  it('update_element y update_relation fijan, reemplazan y quitan el estilo', () => {
    const style = { fillColor: '#ffeecc', fontFamily: 'monospace', fontSize: 16 };
    const res = apply([
      { op: 'update_element', id: 'Libro', changes: { style } },
      { op: 'update_relation', id: 'r1', changes: { style: { borderColor: '#ff0000' } } },
    ]);
    expect(res.ok && res.diagram.elements.find((e) => e.id === 'Libro')?.style).toEqual(style);
    expect(res.ok && res.diagram.relations[0]?.style).toEqual({ borderColor: '#ff0000' });

    const replaced = apply([{ op: 'update_element', id: 'Libro', changes: { style: { fontColor: '#000000' } } }], res.ok ? res.diagram : base());
    expect(replaced.ok && replaced.diagram.elements.find((e) => e.id === 'Libro')?.style).toEqual({ fontColor: '#000000' });

    const cleared = apply(
      [
        { op: 'update_element', id: 'Libro', changes: { style: null } },
        { op: 'update_relation', id: 'r1', changes: { style: null } },
      ],
      res.ok ? res.diagram : base(),
    );
    expect(cleared.ok && cleared.diagram.elements.find((e) => e.id === 'Libro')).not.toHaveProperty('style');
    expect(cleared.ok && cleared.diagram.relations[0]).not.toHaveProperty('style');
  });

  it('add_element y add_relation conservan el estilo', () => {
    const res = apply([
      { op: 'add_element', element: { id: 'Editorial', kind: 'class', name: 'Editorial', attributes: [], operations: [], style: { borderColor: '#123456' } } },
      { op: 'add_relation', relation: { id: 'r3', kind: 'association', source: 'Libro', target: 'Editorial', style: { fontSize: 10 } } },
    ]);
    expect(res.ok && res.diagram.elements.at(-1)?.style).toEqual({ borderColor: '#123456' });
    expect(res.ok && res.diagram.relations.at(-1)?.style).toEqual({ fontSize: 10 });
  });

  it.each([
    ['fillColor', 'rojo'],
    ['borderColor', '#fff'],
    ['fontColor', '#12345g'],
    ['fontFamily', 'Comic Sans'],
    ['fontSize', 7],
    ['fontSize', 49],
    ['fontSize', 12.5],
  ])('estilo inválido (%s = %s) ⇒ SCHEMA_VIOLATION con path y hint', (campo, valor) => {
    const res = apply([{ op: 'update_element', id: 'Libro', changes: { style: { [campo]: valor } } }]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: `/operations/0/changes/style/${campo}` });
      expect(res.errors[0]?.message).toBeTruthy();
      expect(res.errors[0]?.hint).toBeTruthy();
    }
  });

  it('estilo inválido en una relación indica su path', () => {
    const res = apply([{ op: 'update_relation', id: 'r1', changes: { style: { fillColor: 'azul' } } }]);
    expect(!res.ok && res.errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/operations/0/changes/style/fillColor' });
  });

  it('un campo desconocido dentro de style se rechaza', () => {
    const res = apply([{ op: 'update_element', id: 'Libro', changes: { style: { color: '#000000' } } }]);
    expect(res.ok).toBe(false);
  });
});
