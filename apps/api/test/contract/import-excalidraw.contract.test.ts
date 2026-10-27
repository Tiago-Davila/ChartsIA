import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const archivo = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [
    { id: 'Pedido', type: 'rectangle', x: 40, y: 40, width: 160, height: 80, strokeColor: '#1971c2', backgroundColor: '#a5d8ff', fillStyle: 'solid', boundElements: [{ type: 'text', id: 't1' }] },
    { id: 't1', type: 'text', x: 60, y: 70, width: 100, height: 25, text: 'Pedido', fontSize: 20, containerId: 'Pedido' },
    { id: 'Cliente', type: 'ellipse', x: 400, y: 40, width: 160, height: 80 },
    { id: 'flecha', type: 'arrow', x: 200, y: 80, width: 200, height: 0, points: [[0, 0], [200, 0]], startBinding: { elementId: 'Pedido' }, endBinding: { elementId: 'Cliente' }, startArrowhead: null, endArrowhead: 'arrow' },
    { id: 'viejo', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, isDeleted: true },
    { id: 'web', type: 'embeddable', x: 0, y: 300, width: 100, height: 100 },
  ],
});

describe('contract: import_excalidraw', () => {
  let h: McpHarness;
  beforeEach(async () => { h = await createMcpHarness(); });
  afterEach(() => h.close());

  it('conserva figuras, posiciones y conectores en el diagrama persistido y avisa de lo omitido', async () => {
    const res = await h.call('import_excalidraw', { source: archivo, title: 'Boceto' });

    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ revision: 1, counts: { elements: 2, relations: 1 }, warnings: [expect.stringContaining('embeddable')] });
    const diagram = await h.repo.get(res.structuredContent!.diagramId as string);
    expect(diagram?.title).toBe('Boceto');
    expect(diagram?.elements.find((element) => element.id === 'Pedido')).toMatchObject({
      kind: 'figure', shape: 'rectangle', name: 'Pedido', layout: { x: 40, y: 40 }, style: { borderColor: '#1971c2', fillColor: '#a5d8ff' },
    });
    expect(diagram?.relations[0]).toMatchObject({ kind: 'connector', source: 'Pedido', target: 'Cliente' });
    expect(await h.repo.getActiveId()).toBe(diagram?.id);
  });

  it('rechaza un JSON inválido con code, path y hint sin crear diagramas', async () => {
    const invalid = await h.call('import_excalidraw', { source: '{"type":"excalidraw","elements":[{"type":"rectangle","x":"a","y":0}]}' });

    expect(h.errorCodes(invalid)).toContain('SCHEMA_VIOLATION');
    expect(invalid.structuredContent?.errors?.[0]).toMatchObject({ path: '/source/elements/0/x', message: expect.any(String), hint: expect.any(String) });
    expect(await h.repo.list()).toHaveLength(0);
  });
});
