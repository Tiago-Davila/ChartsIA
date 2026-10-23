import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, fullClass, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

describe('contract: create_diagram', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('entrada válida mínima', async () => {
    const res = await h.call('create_diagram', minimalClass);
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({
      diagramId: 'dg_aaaaaaaaaaaa',
      revision: 1,
      viewUrl: 'http://127.0.0.1:3333/d/dg_aaaaaaaaaaaa',
      counts: { elements: 1, relations: 0 },
      warnings: [],
    });
    const [text, link] = res.content as { type: string; text?: string; uri?: string; mimeType?: string }[];
    expect(text?.type).toBe('text');
    expect(text?.text).toContain('http://127.0.0.1:3333/d/dg_aaaaaaaaaaaa');
    expect(link).toMatchObject({ type: 'resource_link', uri: 'chartsia://diagrams/dg_aaaaaaaaaaaa/export.svg', mimeType: 'image/svg+xml' });
  });

  it('entrada válida completa (todos los kinds de clases, grupos, coordenadas del agente)', async () => {
    const res = await h.call('create_diagram', fullClass);
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ counts: { elements: 6, relations: 5 } });
    const stored = await h.repo.get(res.structuredContent!.diagramId as string);
    expect(stored?.elements.find((e) => e.id === 'Base')?.layout).toMatchObject({ x: 600, y: 0, pinned: true });
    expect(await h.repo.getActiveId()).toBe(stored?.id);
  });

  it('figuras UML: método default, clase abstracta y enum con miembros', async () => {
    const figuras = {
      type: 'class',
      title: 'Figuras',
      elements: [
        { id: 'Figura', kind: 'interface', name: 'Figura', operations: [{ name: 'describir', parameters: [], visibility: '+', default: true }] },
        { id: 'Base', kind: 'class', name: 'Base', abstract: true, attributes: [], operations: [] },
        { id: 'Color', kind: 'enum', name: 'Color', literals: ['ROJO'], attributes: [{ name: 'hex', visibility: '-' }], operations: [{ name: 'f', parameters: [], visibility: '+' }] },
      ],
      relations: [],
    };
    const res = await h.call('create_diagram', figuras);
    expect(res.isError).toBeFalsy();
    const svg = await h.call('export_diagram', { diagramId: res.structuredContent!.diagramId, format: 'svg' });
    const text = String(svg.structuredContent!.content);
    expect(text).toContain('default describir()');
    expect(text).toContain('«abstract»');
    const bad = await h.call('create_diagram', { ...figuras, elements: [{ id: 'C', kind: 'class', name: 'C', attributes: [], operations: [{ name: 'f', parameters: [], visibility: '+', default: true }] }] });
    expect(h.errorCodes(bad)).toEqual(['INVALID_MEMBER']);
  });

  it('rechaza SVG con contenido activo en la frontera MCP y no persiste el diagrama', async () => {
    const src = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')}`;
    const result = await h.call('create_diagram', {
      type: 'class', title: 'Malicioso', elements: [{ id: 'img', kind: 'image', name: 'Imagen', src }], relations: [],
    });
    expect(h.errorCodes(result)).toContain('SCHEMA_VIOLATION');
    expect(await h.repo.list()).toEqual([]);
    expect(h.emitted).toEqual([]);
  });

  it.each([
    ['SCHEMA_VIOLATION', { ...minimalClass, title: '' }],
    ['DUPLICATE_ID', { ...minimalClass, elements: [...minimalClass.elements, { id: 'Pedido', kind: 'enum', name: 'X', literals: ['A'] }] }],
    ['UNKNOWN_REFERENCE', { ...minimalClass, relations: [{ id: 'r', kind: 'association', source: 'Pedido', target: 'Nadie' }] }],
    ['INVALID_PARENT', { ...minimalClass, elements: [{ id: 'C', kind: 'component', name: 'C' }] }],
    ['RELATION_NOT_ALLOWED', { ...minimalClass, elements: [...minimalClass.elements, { id: 'E', kind: 'enum', name: 'E', literals: ['A'] }], relations: [{ id: 'r', kind: 'inheritance', source: 'Pedido', target: 'E' }] }],
    ['INHERITANCE_CYCLE', { ...minimalClass, relations: [{ id: 'r', kind: 'inheritance', source: 'Pedido', target: 'Pedido' }] }],
    ['INVALID_PARENT', { ...minimalClass, elements: [...minimalClass.elements, { id: 'X', kind: 'class', name: 'X', attributes: [], operations: [], parentId: 'Pedido' }] }],
    ['PARENT_CYCLE', { ...minimalClass, elements: [{ id: 'p', kind: 'package', name: 'p', parentId: 'p' }] }],
    ['FIELD_NOT_ALLOWED', { ...minimalClass, elements: [...minimalClass.elements, { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] }], relations: [{ id: 'r', kind: 'dependency', source: 'Pedido', target: 'B', technology: 'HTTP' }] }],
  ])('%s alcanzable: isError con errores accionables y sin efectos', async (code, input) => {
    const res = await h.call('create_diagram', input);
    expect(res.isError).toBe(true);
    expect(h.errorCodes(res)).toContain(code);
    for (const e of res.structuredContent!.errors!) {
      expect(e).toEqual({ code: expect.any(String), path: expect.any(String), message: expect.any(String), hint: expect.any(String) });
    }
    expect((res.content as { text: string }[])[0]!.text).toContain(code);
    expect(await h.repo.list()).toEqual([]);
    expect(h.emitted).toEqual([]);
  });

  it('LIMIT_EXCEEDED alcanzable', async () => {
    const small = await createMcpHarness({ maxElements: 1 });
    const res = await small.call('create_diagram', fullClass);
    expect(small.errorCodes(res)).toEqual(['LIMIT_EXCEEDED']);
    await small.close();
  });

  it('rechaza additionalProperties en cualquier nivel', async () => {
    for (const input of [
      { ...minimalClass, color: 'red' },
      { ...minimalClass, elements: [{ ...minimalClass.elements[0], color: 'red' }] },
    ]) {
      const res = await h.call('create_diagram', input);
      expect(h.errorCodes(res)).toEqual(['SCHEMA_VIOLATION']);
    }
  });

  it('determinismo: dos llamadas iguales producen el mismo layout', async () => {
    const a = await h.call('create_diagram', fullClass);
    const b = await h.call('create_diagram', fullClass);
    const get = async (id: unknown) => (await h.call('get_diagram', { diagramId: id, includeLayout: true })).structuredContent as {
      elements: unknown[];
      relations: unknown[];
    };
    const da = await get(a.structuredContent!.diagramId);
    const db = await get(b.structuredContent!.diagramId);
    expect(da.elements).toEqual(db.elements);
    expect(da.relations).toEqual(db.relations);
  });
});
