import { readFile, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_PREFERENCES } from '@chartsia/core/export';
import { createMcpHarness, fullClass, type McpHarness } from '../support/mcp-test-harness.js';

describe('contract: preferencias de exportación', () => {
  let h: McpHarness;
  let id: string;
  beforeEach(async () => {
    h = await createMcpHarness();
    id = (await h.call('create_diagram', fullClass)).structuredContent!.diagramId as string;
  });
  afterEach(() => h.close());

  const exported = async (args: Record<string, unknown> = {}) => (await h.call('export_diagram', { diagramId: id, ...args })).structuredContent!;

  it('set_preferences lee y guarda export en config.json sin tocar lo demás', async () => {
    expect((await h.call('set_preferences', {})).structuredContent!.export).toEqual(DEFAULT_EXPORT_PREFERENCES);
    await writeFile(h.config.configFile, JSON.stringify({ hub: { port: 1 } }));
    const res = await h.call('set_preferences', { export: { format: 'drawio', margin: 0 } });
    expect(res.structuredContent!.export).toEqual({ ...DEFAULT_EXPORT_PREFERENCES, format: 'drawio', margin: 0 });
    const file = JSON.parse(await readFile(h.config.configFile, 'utf8'));
    expect(file.hub).toEqual({ port: 1 });
    expect(file.export).toEqual({ ...DEFAULT_EXPORT_PREFERENCES, format: 'drawio', margin: 0 });
  });

  it('rechaza opciones inválidas con SCHEMA_VIOLATION', async () => {
    for (const bad of [{ margin: -5 }, { scale: 10 }, { background: 'black' }, { format: 'png' }, { tema: 'x' }]) {
      expect(h.errorCodes(await h.call('set_preferences', { export: bad })), JSON.stringify(bad)).toEqual(['SCHEMA_VIOLATION']);
      expect(h.errorCodes(await h.call('export_diagram', { diagramId: id, ...bad })), JSON.stringify(bad)).toEqual(['SCHEMA_VIOLATION']);
    }
  });

  it('sin preferencias ni opciones la exportación es la de siempre', async () => {
    const out = await exported();
    expect(out.format).toBe('svg');
    expect(out.content).toMatch(/^<svg /);
    expect(out.content).toContain('fill="#ffffff"/>');
    expect(out.downloadUrl).toBe(`http://chartsia.localhost:24278/api/diagrams/${id}/export?format=svg`);
  });

  it('export_diagram usa las preferencias guardadas', async () => {
    await h.call('set_preferences', { export: { format: 'excalidraw', background: 'transparent' } });
    const out = await exported();
    expect(out).toMatchObject({ format: 'excalidraw', filename: 'pedidos.excalidraw' });
    expect(out.content).toContain('"viewBackgroundColor": "transparent"');
    expect((await exported({ format: 'drawio' })).content).toContain('background="none"');
  });

  it('las opciones de la llamada ganan y no se guardan', async () => {
    await h.call('set_preferences', { export: { includeTitle: false } });
    const out = await exported({ format: 'svg', includeTitle: true, background: 'transparent', margin: 0, scale: 2 });
    expect(out.content).toContain('font-weight="700"');
    expect(out.content).not.toContain('fill="#ffffff"/>');
    expect(out.downloadUrl).toContain('format=svg&background=transparent&margin=0&scale=2&includeTitle=true');
    expect((await h.call('set_preferences', {})).structuredContent!.export).toMatchObject({ includeTitle: false, background: 'white', margin: 24, scale: 1 });
  });

  it('el recurso MCP usa las preferencias guardadas', async () => {
    await h.call('set_preferences', { export: { background: 'transparent' } });
    const res = await h.client.readResource({ uri: `chartsia://diagrams/${id}/export.svg` });
    expect((res.contents[0] as { text: string }).text).not.toContain('fill="#ffffff"/>');
  });
});
