import { describe, expect, it } from 'vitest';
import type { Diagram } from '../../../src/model/index.js';
import { applyOperations } from '../../../src/operations/index.js';
import { codes } from '../../support/fixtures.js';

function base(): Diagram {
  return {
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title: 'Biblioteca',
    style: 'clean',
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

  it('set_title fuera de 1–120 chars y set_style inválido ⇒ error', () => {
    for (const op of [
      { op: 'set_title', title: '' },
      { op: 'set_title', title: 'x'.repeat(121) },
      { op: 'set_style', style: 'neon' },
    ]) {
      const res = apply([op]);
      expect(!res.ok && res.errors[0]?.path).toMatch(/^\/operations\/0/);
    }
    const ok = apply([{ op: 'set_style', style: 'sketch' }]);
    expect(ok.ok && ok.diagram.style).toBe('sketch');
  });

  it('valida las reglas de dominio sobre el resultado', () => {
    const res = apply([{ op: 'add_element', element: { id: 'P', kind: 'person', name: 'P' } }]);
    expect(!res.ok && codes(res.errors)).toEqual(['KIND_NOT_ALLOWED']);
  });

  it('respeta el máximo de elementos', () => {
    const res = applyOperations(base(), [{ op: 'add_element', element: { id: 'X', kind: 'package', name: 'X' } }], { maxElements: 5 });
    expect(!res.ok && codes(res.errors)).toEqual(['LIMIT_EXCEEDED']);
  });
});
