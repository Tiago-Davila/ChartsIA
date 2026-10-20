import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const shop = {
  type: 'c4-container',
  title: 'Tienda online',
  elements: [
    { id: 'cliente', kind: 'person', name: 'Cliente', description: 'Compra productos' },
    { id: 'tienda', kind: 'boundary', name: 'Tienda online', boundaryType: 'system' },
    { id: 'web', kind: 'container', name: 'Web', technology: 'React', variant: 'web', parentId: 'tienda' },
    { id: 'api', kind: 'container', name: 'API', technology: 'Nest.js', parentId: 'tienda' },
    { id: 'db', kind: 'container', name: 'BD', technology: 'PostgreSQL', variant: 'database', parentId: 'tienda' },
    { id: 'pagos', kind: 'software-system', name: 'Pasarela de pagos', external: true },
  ],
  relations: [
    { id: 'u1', kind: 'c4-rel', source: 'cliente', target: 'web', label: 'Compra', technology: 'HTTPS' },
    { id: 'u2', kind: 'c4-rel', source: 'web', target: 'api', label: 'Llama a', technology: 'JSON/HTTPS' },
    { id: 'u3', kind: 'c4-rel', source: 'api', target: 'db', label: 'Lee y escribe', technology: 'SQL' },
    { id: 'u4', kind: 'c4-rel', source: 'api', target: 'pagos', label: 'Cobra', technology: 'HTTPS' },
  ],
};

describe('contract: C4', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('acepta un diagrama de contenedores válido y lo dispone con el límite alrededor', async () => {
    const res = await h.call('create_diagram', shop);
    expect(res.isError).toBeFalsy();
    const d = await h.repo.get(res.structuredContent!.diagramId as string);
    const box = (id: string) => d!.elements.find((e) => e.id === id)!.layout!;
    const t = box('tienda');
    for (const id of ['web', 'api', 'db']) {
      const b = box(id);
      expect(b.x >= t.x && b.y >= t.y && b.x + b.width! <= t.x + t.width! && b.y + b.height! <= t.y + t.height!).toBe(true);
    }
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('[Container: PostgreSQL]');
    expect(svg).toContain('Leyenda');
  });

  it('component fuera de un boundary container ⇒ INVALID_PARENT', async () => {
    const res = await h.call('create_diagram', {
      type: 'c4-component',
      title: 'API',
      elements: [{ id: 'ctrl', kind: 'component', name: 'Controller' }],
      relations: [],
    });
    expect(h.errorCodes(res)).toEqual(['INVALID_PARENT']);
    expect(res.structuredContent!.errors![0]!.hint).toMatch(/boundary/);
  });

  it('relación inheritance en C4 ⇒ RELATION_NOT_ALLOWED', async () => {
    const res = await h.call('create_diagram', { ...shop, relations: [{ id: 'x', kind: 'inheritance', source: 'web', target: 'api' }] });
    expect(h.errorCodes(res)).toEqual(['RELATION_NOT_ALLOWED']);
  });

  it('recurso chartsia://schema/{type} describe kinds y relaciones permitidas', async () => {
    const res = await h.client.readResource({ uri: 'chartsia://schema/c4-component' });
    const text = (res.contents[0] as { text: string }).text;
    expect(text).toContain('component');
    expect(text).toContain('c4-rel');
    expect(text).toContain('boundaryType');
  });
});
