import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

describe('contract: eliminar diagrama', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  const newDiagram = async () => (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId as string;
  const listed = async () => ((await h.call('list_diagrams')).structuredContent!.diagrams as { diagramId: string }[]).map((d) => d.diagramId);

  it('delete_diagram borra el diagrama, emite diagram.deleted y deja de listarse', async () => {
    const diagramId = await newDiagram();
    h.emitted.length = 0;
    const res = await h.call('delete_diagram', { diagramId });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ diagramId });
    expect(h.emitted.map((e) => e.name)).toEqual(['diagram.deleted']);
    expect(h.emitted[0]).toMatchObject({ payload: { diagramId } });
    expect(await listed()).toEqual([]);
  });

  it('borrar el diagrama activo deja la lista sin activo', async () => {
    const diagramId = await newDiagram();
    expect((await h.call('list_diagrams')).structuredContent!.activeDiagramId).toBe(diagramId);
    await h.call('delete_diagram', { diagramId });
    expect((await h.call('list_diagrams')).structuredContent!.activeDiagramId).toBeNull();
  });

  it('no se puede deshacer: undo_changes ya no encuentra el diagrama', async () => {
    const diagramId = await newDiagram();
    await h.call('apply_changes', { diagramId, operations: [{ op: 'set_title', title: 'Otro' }] });
    await h.call('delete_diagram', { diagramId });
    expect(h.errorCodes(await h.call('undo_changes', { diagramId, direction: 'undo' }))).toEqual(['DIAGRAM_NOT_FOUND']);
  });

  it('un id inexistente o mal formado ⇒ DIAGRAM_NOT_FOUND y no emite nada', async () => {
    await newDiagram();
    h.emitted.length = 0;
    expect(h.errorCodes(await h.call('delete_diagram', { diagramId: 'dg_zzzzzzzzzzzz' }))).toEqual(['DIAGRAM_NOT_FOUND']);
    expect(h.errorCodes(await h.call('delete_diagram', { diagramId: '../../etc' }))).toEqual(['DIAGRAM_NOT_FOUND']);
    expect(h.emitted).toEqual([]);
    expect(await listed()).toHaveLength(1);
  });

  it('sin diagramId la entrada no es válida (no borra el activo por omisión)', async () => {
    await newDiagram();
    expect(h.errorCodes(await h.call('delete_diagram', {}))).toEqual(['SCHEMA_VIOLATION']);
    expect(await listed()).toHaveLength(1);
  });

  it('delete_diagram se anota como destructiva y no de solo lectura', async () => {
    const tool = (await h.client.listTools()).tools.find((t) => t.name === 'delete_diagram');
    expect(tool?.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false });
  });
});
