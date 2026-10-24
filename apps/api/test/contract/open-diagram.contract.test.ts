import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

describe('contract: open_diagram', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('activa el diagrama, list_diagrams lo refleja y emite active.changed', async () => {
    const first = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId as string;
    await h.call('create_diagram', { ...minimalClass, title: 'Segundo' });
    h.emitted.length = 0;
    const res = await h.call('open_diagram', { diagramId: first });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ diagramId: first, viewUrl: `http://chartsia.localhost:3333/d/${first}` });
    expect((await h.call('list_diagrams')).structuredContent!.activeDiagramId).toBe(first);
    expect(h.emitted).toEqual([{ name: 'active.changed', payload: { diagramId: first } }]);
  });

  it('id inexistente ⇒ DIAGRAM_NOT_FOUND', async () => {
    expect(h.errorCodes(await h.call('open_diagram', { diagramId: 'dg_zzzzzzzzzzzz' }))).toEqual(['DIAGRAM_NOT_FOUND']);
  });

  it('diagramId es obligatorio', async () => {
    expect(h.errorCodes(await h.call('open_diagram', {}))).toEqual(['SCHEMA_VIOLATION']);
  });
});
