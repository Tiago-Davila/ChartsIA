import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, fullClass, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

describe('contract: get_diagram y list_diagrams', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('list_diagrams sin diagramas', async () => {
    const res = await h.call('list_diagrams');
    expect(res.structuredContent).toEqual({ activeDiagramId: null, diagrams: [], projects: [] });
  });

  it('list_diagrams devuelve el activo y los resúmenes', async () => {
    const a = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId;
    const b = (await h.call('create_diagram', { ...minimalClass, title: 'Otro' })).structuredContent!.diagramId;
    const res = await h.call('list_diagrams');
    expect(res.structuredContent).toMatchObject({ activeDiagramId: b });
    expect((res.structuredContent!.diagrams as { diagramId: string }[]).map((d) => d.diagramId).sort()).toEqual([a, b].sort());
  });

  it('get_diagram mínimo devuelve el activo sin layout', async () => {
    await h.call('create_diagram', fullClass);
    const res = await h.call('get_diagram');
    const d = res.structuredContent as { elements: object[]; relations: object[]; title: string };
    expect(d.title).toBe('Pedidos');
    expect(d.elements.some((e) => 'layout' in e)).toBe(false);
    expect(d.relations.some((r) => 'route' in r)).toBe(false);
  });

  it('get_diagram con includeLayout refleja move_element hecho por la app', async () => {
    const id = (await h.call('create_diagram', fullClass)).structuredContent!.diagramId as string;
    await h.commands.apply({ diagramId: id, operations: [{ op: 'move_element', id: 'Pedido', x: 1234, y: 567 }], origin: 'app' });
    const res = await h.call('get_diagram', { diagramId: id, includeLayout: true });
    const el = (res.structuredContent as { elements: { id: string; layout: object }[] }).elements.find((e) => e.id === 'Pedido');
    expect(el?.layout).toMatchObject({ x: 1234, y: 567, pinned: true });
    expect(res.structuredContent).toMatchObject({ revision: 2 });
  });

  it('DIAGRAM_NOT_FOUND con id inexistente y NO_ACTIVE_DIAGRAM sin activo', async () => {
    expect(h.errorCodes(await h.call('get_diagram'))).toEqual(['NO_ACTIVE_DIAGRAM']);
    expect(h.errorCodes(await h.call('get_diagram', { diagramId: 'dg_zzzzzzzzzzzz' }))).toEqual(['DIAGRAM_NOT_FOUND']);
  });

  it('rechaza additionalProperties', async () => {
    expect(h.errorCodes(await h.call('get_diagram', { verbose: true }))).toEqual(['SCHEMA_VIOLATION']);
    expect(h.errorCodes(await h.call('list_diagrams', { page: 2 }))).toEqual(['SCHEMA_VIOLATION']);
  });

  it('recurso chartsia://diagrams/{id} equivale a get_diagram', async () => {
    const id = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId as string;
    const res = await h.client.readResource({ uri: `chartsia://diagrams/${id}` });
    const text = (res.contents[0] as { text: string }).text;
    const viaTool = (await h.call('get_diagram', { diagramId: id })).structuredContent;
    expect(JSON.parse(text)).toEqual(viaTool);
  });
});
