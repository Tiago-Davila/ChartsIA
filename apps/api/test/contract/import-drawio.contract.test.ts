import { deflateRawSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';
import { sampleDiagram } from '../support/hub.js';

describe('contract: import_drawio', () => {
  let h: McpHarness;
  beforeEach(async () => { h = await createMcpHarness(); });
  afterEach(() => h.close());

  /** Exporta a draw.io un diagrama creado por la herramienta, como lo haría una persona. */
  async function exported(): Promise<{ id: string; content: string }> {
    const created = await h.call('create_diagram', sampleDiagram);
    const id = created.structuredContent!.diagramId as string;
    const file = await h.call('export_diagram', { diagramId: id, format: 'drawio' });
    return { id, content: file.structuredContent!.content as string };
  }

  it('reimporta lo que exporta ChartsIA: mismos elementos, relaciones y posiciones', async () => {
    const { id, content } = await exported();
    const res = await h.call('import_drawio', { source: content, title: 'Reimportado' });

    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ revision: 1, counts: { elements: 2, relations: 1 }, warnings: [] });
    const original = await h.repo.get(id);
    const copy = await h.repo.get(res.structuredContent!.diagramId as string);
    expect(copy?.title).toBe('Reimportado');
    expect(copy?.elements.map((e) => ({ id: e.id, kind: e.kind, x: e.layout?.x, y: e.layout?.y }))).toEqual(
      original?.elements.map((e) => ({ id: e.id, kind: e.kind, x: e.layout?.x, y: e.layout?.y })),
    );
    expect(copy?.elements.find((e) => e.id === 'Libro')).toMatchObject({ attributes: [{ name: 'isbn', type: 'String', visibility: '-' }] });
    expect(copy?.relations[0]).toMatchObject({ id: 'r1', kind: 'association', source: 'Libro', target: 'Autor' });
    expect(await h.repo.getActiveId()).toBe(copy?.id);
  });

  it('acepta el diagrama comprimido dentro del .drawio', async () => {
    const { content } = await exported();
    const model = /<mxGraphModel[\s\S]*<\/mxGraphModel>/.exec(content)![0];
    const packed = deflateRawSync(Buffer.from(encodeURIComponent(model))).toString('base64');
    const res = await h.call('import_drawio', { source: `<mxfile><diagram name="Biblioteca">${packed}</diagram></mxfile>` });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ counts: { elements: 2, relations: 1 } });
  });

  it('rechaza DOCTYPE y XML inválido con code, path y hint, sin crear diagramas', async () => {
    const evil = await h.call('import_drawio', {
      source: '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><mxGraphModel><root>&e;</root></mxGraphModel>',
    });
    expect(evil.isError).toBe(true);
    expect(h.errorCodes(evil)).toContain('SCHEMA_VIOLATION');
    expect(evil.structuredContent?.errors?.[0]).toMatchObject({ path: '/source', message: expect.stringContaining('DOCTYPE'), hint: expect.stringMatching(/\S/) });

    const broken = await h.call('import_drawio', { source: '<mxGraphModel><root></mxGraphModel>' });
    expect(h.errorCodes(broken)).toContain('SCHEMA_VIOLATION');
    expect(await h.repo.list()).toHaveLength(0);
  });
});
