import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const diagram = (type: string) => ({
  type,
  title: 'Conectores',
  elements: [
    { id: 'c', kind: 'figure', name: 'Círculo', shape: 'circle' },
    { id: 'n', kind: 'figure', name: 'Nube', shape: 'cloud' },
  ],
  relations: [{ id: 'k', kind: 'connector', source: 'c', target: 'n', label: 'une', arrowheads: 'both', dashed: true }],
});

describe('contract: conectores libres', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it.each(['class', 'c4-context', 'c4-container', 'c4-component', 'er'])('se permite en un diagrama %s', async (type) => {
    const res = await h.call('create_diagram', diagram(type));
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent!.counts).toEqual({ elements: 2, relations: 1 });
  });

  it('une una figura con una entity en er y se dibuja en el SVG', async () => {
    const er = diagram('er');
    er.elements.push({ id: 'e', kind: 'entity', name: 'Cliente' } as never);
    er.relations.push({ id: 'k2', kind: 'connector', source: 'e', target: 'c' } as never);
    expect((await h.call('create_diagram', er)).isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('une');
    expect(svg).toContain('stroke-dasharray');
  });

  it('update_relation cambia puntas y trazo, y null los elimina', async () => {
    await h.call('create_diagram', diagram('class'));
    const changed = await h.call('apply_changes', { operations: [{ op: 'update_relation', id: 'k', changes: { arrowheads: 'none', dashed: null } }] });
    expect(changed.isError).toBeFalsy();
    const read = await h.call('get_diagram', {});
    const rel = (read.structuredContent as unknown as { relations: Record<string, unknown>[] }).relations[0]!;
    expect(rel.arrowheads).toBe('none');
    expect(rel.dashed).toBeUndefined();
  });

  it('un valor de puntas inválido se rechaza', async () => {
    await h.call('create_diagram', diagram('class'));
    const res = await h.call('apply_changes', { operations: [{ op: 'update_relation', id: 'k', changes: { arrowheads: 'start' } }] });
    expect(res.isError).toBe(true);
  });

  it('arrowheads y dashed no valen en otras relaciones', async () => {
    const bad = diagram('class');
    bad.relations = [{ id: 'k', kind: 'dependency', source: 'c', target: 'n', dashed: true } as never];
    expect(h.errorCodes(await h.call('create_diagram', bad))).toContain('FIELD_NOT_ALLOWED');
  });

  it('la guía por tipo de diagrama documenta connector', async () => {
    for (const type of ['class', 'c4-container', 'er']) {
      const res = await h.client.readResource({ uri: `chartsia://schema/${type}` });
      const text = (res.contents[0] as { text: string }).text;
      expect(text).toContain('`connector`');
      expect(text).toContain('arrowheads');
    }
  });
});
