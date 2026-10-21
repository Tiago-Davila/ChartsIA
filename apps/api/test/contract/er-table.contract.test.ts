import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const shop = {
  type: 'er',
  title: 'Tablas',
  elements: [
    { id: 'cliente', kind: 'table', name: 'cliente', columns: [{ name: 'id', type: 'INT', pk: true, notNull: true }] },
    { id: 'pedido', kind: 'table', name: 'pedido', columns: [{ name: 'id', type: 'INT', pk: true }, { name: 'cliente_id', type: 'INT', fk: { table: 'cliente', column: 'id' } }] },
  ],
  relations: [{ id: 'r1', kind: 'er-rel', source: 'cliente', target: 'pedido', sourceCardinality: 'one', targetCardinality: 'zero-many' }],
};

describe('contract: tablas ER', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea tablas con FK, las dispone y las exporta', async () => {
    const res = await h.call('create_diagram', shop);
    expect(res.isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('FK cliente_id: INT');
  });

  it('FK a una columna que no es PK ⇒ INVALID_MEMBER con path y hint', async () => {
    const bad = { ...shop, elements: [{ ...shop.elements[0]!, columns: [{ name: 'id', type: 'INT' }] }, shop.elements[1]!] };
    const res = await h.call('create_diagram', bad);
    expect(h.errorCodes(res)).toEqual(['INVALID_MEMBER']);
    expect(res.structuredContent!.errors![0]).toMatchObject({ path: '/elements/1/columns/1/fk/column' });
    expect(res.structuredContent!.errors![0]!.hint).toBeTruthy();
  });

  it('apply_changes reemplaza las columnas de una tabla', async () => {
    await h.call('create_diagram', shop);
    const res = await h.call('apply_changes', {
      operations: [{ op: 'update_element', id: 'cliente', changes: { columns: [{ name: 'id', type: 'INT', pk: true }, { name: 'email', type: 'TEXT', unique: true }] } }],
    });
    expect(res.isError).toBeFalsy();
  });
});
