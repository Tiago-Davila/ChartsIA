import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const shop = {
  type: 'er',
  title: 'Tienda',
  elements: [
    { id: 'cliente', kind: 'entity', name: 'Cliente' },
    { id: 'pedido', kind: 'entity', name: 'Pedido' },
    { id: 'linea', kind: 'entity', name: 'Línea', weak: true },
  ],
  relations: [
    { id: 'r1', kind: 'er-rel', source: 'cliente', target: 'pedido', label: 'hace', sourceCardinality: 'one', targetCardinality: 'zero-many' },
    { id: 'r2', kind: 'er-rel', source: 'pedido', target: 'linea', identifying: true, sourceCardinality: 'one', targetCardinality: 'one-many' },
  ],
};

describe('contract: ER', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea un diagrama er, lo dispone y lo exporta', async () => {
    const res = await h.call('create_diagram', shop);
    expect(res.isError).toBeFalsy();
    const d = await h.repo.get(res.structuredContent!.diagramId as string);
    expect(d!.type).toBe('er');
    expect(d!.relations.every((r) => (r.route?.length ?? 0) >= 2)).toBe(true);
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('Línea');
  });

  it('sin cardinalidad ⇒ FIELD_REQUIRED con path y hint', async () => {
    const res = await h.call('create_diagram', { ...shop, relations: [{ id: 'x', kind: 'er-rel', source: 'cliente', target: 'pedido' }] });
    expect(h.errorCodes(res)).toEqual(['FIELD_REQUIRED', 'FIELD_REQUIRED']);
    expect(res.structuredContent!.errors![0]).toMatchObject({ path: '/relations/0/sourceCardinality' });
    expect(res.structuredContent!.errors![0]!.hint).toBeTruthy();
  });

  it('kind de clases en er es válido: los kinds valen en cualquier tipo de diagrama', async () => {
    const res = await h.call('create_diagram', { ...shop, elements: [{ id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] }], relations: [] });
    expect(res.isError).not.toBe(true);
  });

  it('apply_changes cambia la cardinalidad y marca una entidad como débil', async () => {
    await h.call('create_diagram', shop);
    const res = await h.call('apply_changes', {
      operations: [
        { op: 'update_relation', id: 'r1', changes: { targetCardinality: 'zero-one', identifying: true } },
        { op: 'update_element', id: 'pedido', changes: { weak: true } },
      ],
    });
    expect(res.isError).toBeFalsy();
  });
});
