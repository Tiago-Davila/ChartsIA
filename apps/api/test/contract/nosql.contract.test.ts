import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const pedido = {
  type: 'nosql',
  title: 'Pedidos',
  elements: [
    {
      id: 'Pedidos',
      kind: 'collection',
      name: 'pedidos',
      fields: [
        { path: ['cliente'], type: 'object' },
        { path: ['cliente', 'nombre'], type: 'string' },
        { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
        { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
        { path: ['cliente', 'direcciones', 'ciudad'], type: 'string' },
      ],
    },
    { id: 'Clientes', kind: 'collection', name: 'clientes', fields: [{ path: ['nombre'], type: 'string' }] },
  ],
  relations: [{ id: 'r1', kind: 'nosql-rel', source: 'Pedidos', target: 'Clientes', label: 'clienteId' }],
};

describe('contract: diagramas NoSQL', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea, edita y exporta colecciones con subdocumentos y arrays anidados', async () => {
    const created = await h.call('create_diagram', pedido);
    expect(created.isError).toBeFalsy();
    const id = created.structuredContent!.diagramId as string;
    const stored = await h.repo.get(id);
    expect(stored?.type).toBe('nosql');
    expect(stored?.elements.find((element) => element.id === 'Pedidos')).toMatchObject({
      kind: 'collection',
      fields: expect.arrayContaining([
        { path: ['cliente'], type: 'object' },
        { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
        { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
      ]),
    });
    expect(stored?.relations).toMatchObject([{ kind: 'nosql-rel', source: 'Pedidos', target: 'Clientes' }]);

    const updated = await h.call('apply_changes', {
      operations: [{
        op: 'update_element',
        id: 'Pedidos',
        changes: { fields: [...pedido.elements[0]!.fields, { path: ['estado'], type: 'string' }] },
      }],
    });
    expect(updated.isError).toBeFalsy();
    expect((await h.repo.get(id))?.elements.find((element) => element.id === 'Pedidos')).toMatchObject({
      fields: expect.arrayContaining([{ path: ['estado'], type: 'string' }]),
    });

    for (const format of ['svg', 'drawio', 'excalidraw'] as const) {
      const result = await h.call('export_diagram', { diagramId: id, format });
      expect(result.isError).toBeFalsy();
      const content = String(result.structuredContent!.content);
      expect(content).toContain('direcciones');
      expect(content).toContain('calle');
      expect(content).toContain('estado');
    }
  });

  it('documenta la forma y el límite NoSQL en su recurso MCP', async () => {
    const res = await h.client.readResource({ uri: 'chartsia://schema/nosql' });
    const text = (res.contents[0] as { text: string }).text;
    expect(text).toContain('array<object>');
    expect(text).toContain('máx. 200');
    expect(text).toContain('nosql-rel');

    const tools = (await h.client.listTools()).tools;
    const create = tools.find((tool) => tool.name === 'create_diagram')!;
    const apply = tools.find((tool) => tool.name === 'apply_changes')!;
    expect(create.description).toContain('Pedido NoSQL con cliente y direcciones embebidas');
    expect(create.description).toContain('"cliente","direcciones"');
    expect(apply.description).toContain('update_element admite fields');
    expect(apply.description).toContain('nosql-rel');
  });

  it('devuelve errores de ruta accionables y no persiste campos duplicados', async () => {
    const invalid = {
      ...pedido,
      elements: [{
        id: 'Pedidos',
        kind: 'collection',
        name: 'pedidos',
        fields: [
          { path: ['estado'], type: 'string' },
          { path: ['estado'], type: 'number' },
        ],
      }],
      relations: [],
    };
    const result = await h.call('create_diagram', invalid);
    expect(result.isError).toBe(true);
    expect(result.structuredContent!.errors).toContainEqual(expect.objectContaining({
      code: 'INVALID_NOSQL_FIELD',
      path: '/elements/0/fields/1/path',
      hint: expect.any(String),
    }));
    expect(await h.repo.list()).toEqual([]);
  });
});
