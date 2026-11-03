import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const minimo = {
  type: 'flow',
  title: 'Login',
  elements: [
    { id: 'api', kind: 'flow-node', variant: 'trigger', name: 'POST /login' },
    { id: 'usuarios', kind: 'flow-node', variant: 'database', name: 'users' },
  ],
  relations: [{ id: 'api_usuarios', kind: 'flow-edge', source: 'api', target: 'usuarios', flowType: 'read' }],
};

const completo = {
  type: 'flow',
  title: 'Alta de pedido',
  elements: [
    { id: 'api', kind: 'flow-node', variant: 'trigger', name: 'POST /orders', subtitle: 'src/orders/controller.ts:18' },
    { id: 'modulo', kind: 'frame', name: 'src/orders' },
    { id: 'servicio', kind: 'flow-node', variant: 'method', name: 'OrdersService.create', subtitle: 'src/orders/service.ts:42', parentId: 'modulo' },
    { id: 'stock', kind: 'flow-node', variant: 'decision', name: '¿Hay stock?', subtitle: 'src/orders/service.ts:57', parentId: 'modulo' },
    { id: 'repo', kind: 'flow-node', variant: 'file', name: 'orders.repository.ts', subtitle: 'src/orders/repository.ts:12', parentId: 'modulo' },
    { id: 'rechazo', kind: 'flow-node', variant: 'method', name: 'OrdersService.reject', subtitle: 'src/orders/service.ts:80', parentId: 'modulo' },
    { id: 'db', kind: 'flow-node', variant: 'database', name: 'orders', subtitle: 'PostgreSQL' },
    { id: 'cola', kind: 'flow-node', variant: 'queue', name: 'orders.created' },
    { id: 'correo', kind: 'flow-node', variant: 'external', name: 'SendGrid' },
  ],
  relations: [
    { id: 'r1', kind: 'flow-edge', source: 'api', target: 'servicio' },
    { id: 'r2', kind: 'flow-edge', source: 'servicio', target: 'stock' },
    { id: 'r3', kind: 'flow-edge', source: 'stock', target: 'repo', label: 'sí' },
    { id: 'r4', kind: 'flow-edge', source: 'stock', target: 'rechazo', label: 'no' },
    { id: 'r5', kind: 'flow-edge', source: 'repo', target: 'db', flowType: 'write', label: 'insert' },
    { id: 'r6', kind: 'flow-edge', source: 'repo', target: 'cola', flowType: 'event' },
    { id: 'r7', kind: 'flow-edge', source: 'cola', target: 'correo', flowType: 'data', label: 'confirmación' },
  ],
};

describe('contract: flujos de sistema', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea un flujo mínimo y lo ubica de izquierda a derecha', async () => {
    const created = await h.call('create_diagram', minimo);
    expect(created.isError).toBeFalsy();
    expect(created.structuredContent!.counts).toEqual({ elements: 2, relations: 1 });
    const stored = await h.repo.get(created.structuredContent!.diagramId as string);
    expect(stored?.type).toBe('flow');
    const x = (id: string) => stored!.elements.find((element) => element.id === id)!.layout!.x;
    expect(x('api')).toBeLessThan(x('usuarios'));
  });

  it('el ejemplo de la skill chartsia-flujo-de-sistema es una entrada válida', async () => {
    const skill = readFileSync(new URL('../../../../skills/chartsia-flujo-de-sistema/SKILL.md', import.meta.url), 'utf8');
    const ejemplo = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(skill)![1]!);
    const created = await h.call('create_diagram', ejemplo);
    expect(created.isError, JSON.stringify(created.structuredContent)).toBeFalsy();
    expect(created.structuredContent!.counts).toEqual({ elements: 9, relations: 7 });
  });

  it('crea un flujo completo con las variantes, los tipos de conexión y un frame', async () => {
    const created = await h.call('create_diagram', completo);
    expect(created.isError).toBeFalsy();
    expect(created.structuredContent!.counts).toEqual({ elements: 9, relations: 7 });
    const stored = await h.repo.get(created.structuredContent!.diagramId as string);
    expect(stored?.relations.find((relation) => relation.id === 'r5')).toMatchObject({ kind: 'flow-edge', flowType: 'write' });
    expect(stored?.elements.find((element) => element.id === 'servicio')).toMatchObject({ variant: 'method', subtitle: 'src/orders/service.ts:42', parentId: 'modulo' });
  });

  it('rechaza una variante inválida con path y hint', async () => {
    const invalido = { ...minimo, elements: [{ id: 'api', kind: 'flow-node', variant: 'robot', name: 'API' }], relations: [] };
    const result = await h.call('create_diagram', invalido);
    expect(result.isError).toBe(true);
    expect(result.structuredContent!.errors).toContainEqual(expect.objectContaining({
      code: 'SCHEMA_VIOLATION',
      path: '/elements/0/variant',
      hint: expect.any(String),
    }));
    expect(await h.repo.list()).toEqual([]);
  });

  it('rechaza una salida de decisión sin etiqueta', async () => {
    const invalido = {
      ...completo,
      relations: completo.relations.map(({ label, ...relation }) => (relation.id === 'r4' ? relation : { ...relation, label })),
    };
    const result = await h.call('create_diagram', invalido);
    expect(result.isError).toBe(true);
    expect(result.structuredContent!.errors).toContainEqual(expect.objectContaining({
      code: 'FIELD_REQUIRED',
      path: '/relations/3/label',
      hint: expect.stringContaining('label'),
    }));
  });

  it('rechaza una conexión de flujo entre nodos que no son de flujo', async () => {
    const invalido = {
      ...minimo,
      elements: [...minimo.elements, { id: 'Pedido', kind: 'class', name: 'Pedido', attributes: [], operations: [] }],
      relations: [{ id: 'r', kind: 'flow-edge', source: 'api', target: 'Pedido' }],
    };
    const result = await h.call('create_diagram', invalido);
    expect(result.isError).toBe(true);
    expect(result.structuredContent!.errors).toContainEqual(expect.objectContaining({
      code: 'RELATION_NOT_ALLOWED',
      path: '/relations/0/kind',
      hint: expect.stringContaining('flow-node'),
    }));
  });

  it('rechaza propiedades desconocidas en nodos y conexiones', async () => {
    const nodo = await h.call('create_diagram', {
      ...minimo,
      elements: [{ id: 'api', kind: 'flow-node', variant: 'trigger', name: 'API', color: 'rojo' }],
      relations: [],
    });
    expect(nodo.isError).toBe(true);
    expect(nodo.structuredContent!.errors?.[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/elements/0' });

    const conexion = await h.call('create_diagram', {
      ...minimo,
      relations: [{ id: 'r', kind: 'flow-edge', source: 'api', target: 'usuarios', grosor: 3 }],
    });
    expect(conexion.isError).toBe(true);
    expect(conexion.structuredContent!.errors?.[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/relations/0' });
  });

  it('dos create_diagram iguales dan el mismo layout', async () => {
    const first = await h.repo.get((await h.call('create_diagram', completo)).structuredContent!.diagramId as string);
    const second = await h.repo.get((await h.call('create_diagram', completo)).structuredContent!.diagramId as string);
    expect(second?.elements.map((element) => element.layout)).toEqual(first?.elements.map((element) => element.layout));
    expect(second?.relations.map((relation) => relation.route)).toEqual(first?.relations.map((relation) => relation.route));
  });

  it('apply_changes agrega un nodo sin mover los existentes', async () => {
    const id = (await h.call('create_diagram', completo)).structuredContent!.diagramId as string;
    const before = await h.repo.get(id);

    const added = await h.call('apply_changes', {
      diagramId: id,
      operations: [
        { op: 'add_element', element: { id: 'auditoria', kind: 'flow-node', variant: 'service', name: 'AuditService', subtitle: 'src/audit/service.ts:9' } },
        { op: 'add_relation', relation: { id: 'r8', kind: 'flow-edge', source: 'repo', target: 'auditoria', flowType: 'call' } },
        { op: 'update_element', id: 'db', changes: { subtitle: 'db/schema.sql:30' } },
        { op: 'update_relation', id: 'r5', changes: { flowType: 'data' } },
      ],
    });
    expect(added.isError).toBeFalsy();
    const after = await h.repo.get(id);
    expect(after?.elements.find((element) => element.id === 'auditoria')?.layout).toBeDefined();
    expect(after?.elements.find((element) => element.id === 'db')).toMatchObject({ subtitle: 'db/schema.sql:30' });
    expect(after?.relations.find((relation) => relation.id === 'r5')).toMatchObject({ flowType: 'data' });
    for (const element of before!.elements) {
      expect(after?.elements.find((other) => other.id === element.id)?.layout, element.id).toEqual(element.layout);
    }
  });

  it('apply_changes rechaza una variante inválida y no cambia nada', async () => {
    const id = (await h.call('create_diagram', minimo)).structuredContent!.diagramId as string;
    const result = await h.call('apply_changes', {
      diagramId: id,
      operations: [{ op: 'add_element', element: { id: 'x', kind: 'flow-node', variant: 'robot', name: 'X' } }],
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent!.errors?.[0]).toMatchObject({ path: expect.stringContaining('/operations/0/element'), hint: expect.any(String) });
    expect((await h.repo.get(id))?.elements).toHaveLength(2);
  });

  it('exporta un flujo a SVG, draw.io y Excalidraw', async () => {
    const id = (await h.call('create_diagram', completo)).structuredContent!.diagramId as string;
    for (const format of ['svg', 'drawio', 'excalidraw'] as const) {
      const result = await h.call('export_diagram', { diagramId: id, format });
      expect(result.isError, format).toBeFalsy();
      const content = String(result.structuredContent!.content);
      expect(content, format).toContain('POST /orders');
      expect(content, format).toContain('orders.created');
    }
  });

  it('documenta variantes, conexiones y la regla de la decisión en su recurso MCP', async () => {
    const res = await h.client.readResource({ uri: 'chartsia://schema/flow' });
    const text = (res.contents[0] as { text: string }).text;
    for (const palabra of ['trigger', 'decision', 'external', 'flow-node', 'flow-edge', 'flowType', 'subtitle', 'frame', 'FIELD_REQUIRED']) {
      expect(text).toContain(palabra);
    }
  });

  it('las descripciones y las instrucciones del servidor mencionan los flujos', async () => {
    const tools = (await h.client.listTools()).tools;
    const create = tools.find((tool) => tool.name === 'create_diagram')!;
    const apply = tools.find((tool) => tool.name === 'apply_changes')!;
    expect(create.description).toContain('flow-edge');
    expect(create.description).toContain('Flujo de sistema con una decisión');
    expect(apply.description).toContain('flow-node');
    expect(h.client.getInstructions()).toContain('flow');
  });
});
