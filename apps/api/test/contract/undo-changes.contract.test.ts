import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

describe('contract: undo_changes', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('deshace y rehace el último cambio del diagrama activo', async () => {
    const id = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId as string;
    await h.call('apply_changes', { operations: [{ op: 'remove_element', id: 'Pedido' }] });

    const undo = await h.call('undo_changes', { direction: 'undo' });
    expect(undo.isError).toBeFalsy();
    expect(undo.structuredContent).toEqual({ diagramId: id, revision: 3, viewUrl: `http://chartsia.localhost:3333/d/${id}` });
    expect((await h.repo.get(id))?.elements.map((e) => e.id)).toEqual(['Pedido']);

    await h.call('undo_changes', { diagramId: id, direction: 'redo' });
    expect((await h.repo.get(id))?.elements).toEqual([]);
  });

  it('sin cambios ⇒ NOTHING_TO_UNDO; direction es obligatoria', async () => {
    await h.call('create_diagram', minimalClass);
    expect(h.errorCodes(await h.call('undo_changes', { direction: 'undo' }))).toEqual(['NOTHING_TO_UNDO']);
    expect(h.errorCodes(await h.call('undo_changes', {}))).toEqual(['SCHEMA_VIOLATION']);
  });
});
