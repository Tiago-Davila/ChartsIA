import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, fullClass, type McpHarness } from '../support/mcp-test-harness.js';

describe('contract: export_diagram', () => {
  let h: McpHarness;
  let id: string;
  beforeEach(async () => {
    h = await createMcpHarness();
    id = (await h.call('create_diagram', fullClass)).structuredContent!.diagramId as string;
  });
  afterEach(() => h.close());

  it.each([
    ['svg', 'image/svg+xml', /^<svg /],
    ['drawio', 'application/vnd.jgraph.mxfile', /<mxGraphModel/],
    ['excalidraw', 'application/vnd.excalidraw+json', /"type": "excalidraw"/],
  ])('%s', async (format, mimeType, pattern) => {
    const res = await h.call('export_diagram', { format });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({
      diagramId: id,
      format,
      mimeType,
      filename: `pedidos.${format}`,
      downloadUrl: `http://chartsia.localhost:3333/api/diagrams/${id}/export?format=${format}`,
    });
    expect(res.structuredContent!.content).toMatch(pattern);
  });

  it('ya no acepta style (el estilo boceto se retiró)', async () => {
    const res = await h.call('export_diagram', { diagramId: id, format: 'svg', style: 'sketch' });
    expect(res.isError).toBe(true);
  });

  it('omite content si supera 512 KiB y devuelve solo downloadUrl', async () => {
    const elements = Array.from({ length: 400 }, (_, i) => ({
      id: `C${i}`, kind: 'class', name: `Clase${i}`, attributes: Array.from({ length: 12 }, (_, j) => ({ name: `campoNumero${j}`, type: 'String', visibility: '-' })), operations: [],
    }));
    const big = (await h.call('create_diagram', { type: 'class', title: 'Grande', elements, relations: [] })).structuredContent!.diagramId;
    const res = await h.call('export_diagram', { diagramId: big, format: 'svg' });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).not.toHaveProperty('content');
    expect(res.structuredContent!.downloadUrl).toContain(String(big));
  });

  it('recurso MCP equivalente chartsia://diagrams/{id}/export.{ext}', async () => {
    const viaTool = await h.call('export_diagram', { format: 'drawio' });
    const res = await h.client.readResource({ uri: `chartsia://diagrams/${id}/export.drawio` });
    expect(res.contents[0]).toMatchObject({ mimeType: 'application/vnd.jgraph.mxfile', text: viaTool.structuredContent!.content });
  });

  it('errores: formato inválido, diagrama inexistente', async () => {
    expect(h.errorCodes(await h.call('export_diagram', { format: 'png' }))).toEqual(['SCHEMA_VIOLATION']);
    expect(h.errorCodes(await h.call('export_diagram', { diagramId: 'dg_zzzzzzzzzzzz', format: 'svg' }))).toEqual(['DIAGRAM_NOT_FOUND']);
  });
});
