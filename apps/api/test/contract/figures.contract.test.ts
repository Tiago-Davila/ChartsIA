import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const figures = (type: string) => ({
  type,
  title: 'Figuras',
  elements: [
    { id: 'c', kind: 'figure', name: 'Círculo', shape: 'circle' },
    { id: 'h', kind: 'figure', name: 'Hexágono', shape: 'hexagon' },
    { id: 'n', kind: 'figure', name: 'Nube', shape: 'cloud' },
  ],
  relations: [],
});

describe('contract: figuras generales', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it.each(['class', 'c4-context', 'c4-container', 'c4-component', 'er'])('se permiten en un diagrama %s', async (type) => {
    const res = await h.call('create_diagram', figures(type));
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent!.counts).toEqual({ elements: 3, relations: 0 });
  });

  it('se dibujan en el SVG y se pueden cambiar de forma con apply_changes', async () => {
    await h.call('create_diagram', figures('class'));
    const res = await h.call('apply_changes', { operations: [{ op: 'update_element', id: 'c', changes: { shape: 'triangle' } }] });
    expect(res.isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('Hexágono');
    expect(svg).toContain('Círculo');
  });

  it('una forma inexistente (heptágono) se rechaza con SCHEMA_VIOLATION', async () => {
    const bad = figures('class');
    bad.elements[0]!.shape = 'heptagon';
    const res = await h.call('create_diagram', bad);
    expect(h.errorCodes(res)).toContain('SCHEMA_VIOLATION');
  });

  it('la guía por tipo de diagrama documenta las figuras', async () => {
    for (const type of ['class', 'er']) {
      const res = await h.client.readResource({ uri: `chartsia://schema/${type}` });
      const text = (res.contents[0] as { text: string }).text;
      expect(text).toContain('`figure`');
      expect(text).toContain('hexagon');
    }
  });
});
