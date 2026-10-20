import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

const library = {
  type: 'class',
  title: 'Biblioteca',
  elements: [
    { id: 'Libro', kind: 'class', name: 'Libro', attributes: [], operations: [] },
    { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [] },
    { id: 'Socio', kind: 'class', name: 'Socio', attributes: [], operations: [] },
    { id: 'Prestamo', kind: 'class', name: 'Préstamo', attributes: [], operations: [] },
  ],
  relations: [
    { id: 'r1', kind: 'association', source: 'Libro', target: 'Autor' },
    { id: 'r2', kind: 'association', source: 'Socio', target: 'Prestamo' },
    { id: 'r3', kind: 'association', source: 'Prestamo', target: 'Libro' },
  ],
};

describe('contract: apply_changes', () => {
  let h: McpHarness;
  let id: string;
  beforeEach(async () => {
    h = await createMcpHarness();
    id = (await h.call('create_diagram', library)).structuredContent!.diagramId as string;
  });
  afterEach(() => h.close());

  it('entrada válida mínima (sobre el diagrama activo)', async () => {
    const res = await h.call('apply_changes', { operations: [{ op: 'set_title', title: 'Biblioteca 2' }] });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ diagramId: id, revision: 2, viewUrl: `http://127.0.0.1:3333/d/${id}`, applied: 1, warnings: [] });
    expect((res.content as { type: string }[])[1]).toMatchObject({ type: 'resource_link' });
  });

  it('entrada válida completa: añadir, renombrar, eliminar con cascada', async () => {
    const res = await h.call('apply_changes', {
      diagramId: id,
      baseRevision: 1,
      operations: [
        { op: 'add_element', element: { id: 'Editorial', kind: 'class', name: 'Editorial', attributes: [], operations: [] } },
        { op: 'add_relation', relation: { id: 'r4', kind: 'association', source: 'Libro', target: 'Editorial' } },
        { op: 'update_element', id: 'Socio', changes: { name: 'Usuario' } },
        { op: 'remove_element', id: 'Prestamo' },
      ],
    });
    expect(res.structuredContent).toMatchObject({ applied: 4, revision: 2 });
    const d = await h.repo.get(id);
    expect(d?.elements.map((e) => e.id).sort()).toEqual(['Autor', 'Editorial', 'Libro', 'Socio']);
    expect(d?.elements.find((e) => e.id === 'Socio')?.name).toBe('Usuario');
    expect(d?.relations.map((r) => r.id).sort()).toEqual(['r1', 'r4']);
  });

  it('atomicidad: un error rechaza el lote completo', async () => {
    const res = await h.call('apply_changes', {
      operations: [{ op: 'set_title', title: 'Cambiado' }, { op: 'remove_relation', id: 'nope' }],
    });
    expect(res.isError).toBe(true);
    expect(h.errorCodes(res)).toEqual(['UNKNOWN_REFERENCE']);
    expect(res.structuredContent!.errors![0]!.path).toBe('/operations/1/id');
    const d = await h.repo.get(id);
    expect(d).toMatchObject({ title: 'Biblioteca', revision: 1 });
  });

  it('NO_ACTIVE_DIAGRAM sin diagramas', async () => {
    const empty = await createMcpHarness();
    const res = await empty.call('apply_changes', { operations: [{ op: 'set_title', title: 'x' }] });
    expect(empty.errorCodes(res)).toEqual(['NO_ACTIVE_DIAGRAM']);
    await empty.close();
  });

  it('DIAGRAM_NOT_FOUND con id inexistente', async () => {
    const res = await h.call('apply_changes', { diagramId: 'dg_zzzzzzzzzzzz', operations: [{ op: 'set_title', title: 'x' }] });
    expect(h.errorCodes(res)).toEqual(['DIAGRAM_NOT_FOUND']);
  });

  it('warning por baseRevision distinta (último gana)', async () => {
    const res = await h.call('apply_changes', { baseRevision: 0, operations: [{ op: 'set_title', title: 'x' }] });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent!.warnings as string[])[0]).toMatch(/baseRevision/);
  });

  it('los nodos pinned quedan intactos tras cambios del agente', async () => {
    await h.commands.apply({ diagramId: id, operations: [{ op: 'move_element', id: 'Autor', x: 900, y: 50 }], origin: 'app' });
    await h.call('apply_changes', {
      operations: [{ op: 'add_element', element: { id: 'N', kind: 'class', name: 'Nuevo', attributes: [], operations: [] } }],
    });
    const d = await h.repo.get(id);
    expect(d?.elements.find((e) => e.id === 'Autor')?.layout).toMatchObject({ x: 900, y: 50, pinned: true });
  });

  it.each([
    ['SCHEMA_VIOLATION', { operations: [] }],
    ['SCHEMA_VIOLATION', { operations: [{ op: 'explode' }] }],
    ['KIND_NOT_ALLOWED', { operations: [{ op: 'add_element', element: { id: 'P', kind: 'person', name: 'P' } }] }],
    ['DUPLICATE_ID', { operations: [{ op: 'add_element', element: { id: 'Libro', kind: 'enum', name: 'L', literals: ['A'] } }] }],
    ['FIELD_NOT_ALLOWED', { operations: [{ op: 'update_element', id: 'Libro', changes: { technology: 'Java' } }] }],
  ])('%s alcanzable', async (code, args) => {
    const res = await h.call('apply_changes', args);
    expect(h.errorCodes(res)).toContain(code);
  });

  it('rechaza additionalProperties', async () => {
    const res = await h.call('apply_changes', { operations: [{ op: 'set_title', title: 'x' }], force: true });
    expect(h.errorCodes(res)).toEqual(['SCHEMA_VIOLATION']);
  });

  it('usa el diagrama activo, que cambia al crear otro', async () => {
    const other = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId;
    const res = await h.call('apply_changes', { operations: [{ op: 'set_title', title: 'activo' }] });
    expect(res.structuredContent!.diagramId).toBe(other);
  });
});
