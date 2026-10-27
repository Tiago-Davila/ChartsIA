import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

type Json = Record<string, unknown>;

function walk(node: unknown, visit: (n: Json, path: string) => void, path = '#'): void {
  if (Array.isArray(node)) node.forEach((n, i) => walk(n, visit, `${path}/${i}`));
  else if (node && typeof node === 'object') {
    // Un mapa `properties` contiene nombres de campo, no palabras clave de JSON Schema.
    if (!path.endsWith('/properties')) visit(node as Json, path);
    for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}/${k}`);
  }
}

describe('contract: listado de tools', () => {
  let h: McpHarness;
  let tools: Awaited<ReturnType<McpHarness['client']['listTools']>>['tools'];
  beforeAll(async () => {
    h = await createMcpHarness();
    tools = (await h.client.listTools()).tools;
  });
  afterAll(() => h.close());

  it('expone las 12 herramientas del contrato', () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['apply_changes', 'create_diagram', 'create_project', 'delete_diagram', 'export_diagram', 'get_diagram', 'import_excalidraw', 'import_mermaid', 'list_diagrams', 'move_diagram', 'open_diagram', 'undo_changes'],
    );
  });

  it('el servidor se identifica como chartsia con versión de esquema 1.0.0', () => {
    expect(h.client.getServerVersion()).toMatchObject({ name: 'chartsia', version: '1.0.0' });
  });

  it('los esquemas cumplen el subconjunto común Claude/OpenAI', () => {
    for (const tool of tools) {
      for (const schema of [tool.inputSchema, tool.outputSchema]) {
        if (!schema) continue;
        expect(schema.type, tool.name).toBe('object');
        walk(schema, (n, path) => {
          const where = `${tool.name} ${path}`;
          expect(n, where).not.toHaveProperty('oneOf');
          expect(n, where).not.toHaveProperty('$ref');
          expect(n, where).not.toHaveProperty('format');
          if (n.type === 'object' && n.properties) expect(n.additionalProperties, where).toBe(false);
        });
      }
    }
  });

  it('cada descripción explica el uso e incluye un ejemplo de entrada JSON (FR-003)', () => {
    for (const tool of tools) {
      expect(tool.description!.length, tool.name).toBeGreaterThan(80);
      const example = /Ejemplo[^:]*:\s*(\{[\s\S]*\})\s*$/m.exec(tool.description!);
      expect(example, tool.name).not.toBeNull();
      expect(() => JSON.parse(example![1]!), tool.name).not.toThrow();
    }
  });

  it('los ejemplos de las descripciones son entradas válidas para su herramienta', async () => {
    const fresh = await createMcpHarness();
    const order = ['create_diagram', 'apply_changes', 'import_mermaid', 'get_diagram', 'list_diagrams', 'export_diagram', 'open_diagram', 'create_project', 'move_diagram', 'delete_diagram', 'import_excalidraw'];
    let projectId = '';
    const created: string[] = [];
    for (const name of order) {
      const tool = tools.find((t) => t.name === name)!;
      const args = JSON.parse(/Ejemplo[^:]*:\s*(\{[\s\S]*\})\s*$/m.exec(tool.description!)![1]!);
      if ('diagramId' in args && created[0]) args.diagramId = created[0];
      if ('projectId' in args) args.projectId = projectId;
      const res = await fresh.call(name, args);
      expect(res.isError, `${name}: ${JSON.stringify(res.structuredContent)}`).toBeFalsy();
      if (name === 'create_diagram' || name === 'import_mermaid') created.push(res.structuredContent!.diagramId as string);
      if (name === 'create_project') projectId = res.structuredContent!.projectId as string;
    }
    await fresh.close();
  });

  it('declara anotaciones de solo lectura y no destructivas', () => {
    const readOnly = tools.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name).sort();
    expect(readOnly).toEqual(['export_diagram', 'get_diagram', 'list_diagrams']);
  });
});
