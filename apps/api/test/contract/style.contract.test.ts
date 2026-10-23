import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DRAWING_WIDTH_PX, FONT_FAMILIES } from '@chartsia/core/model';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const style = { borderColor: '#1f77b4', fillColor: '#e6f0fa', fontColor: '#222222', fontFamily: 'serif', fontSize: 14 };

const diagram = {
  type: 'class',
  title: 'Estilos',
  elements: [
    { id: 'Libro', kind: 'class', name: 'Libro', attributes: [], operations: [], style },
    { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [] },
  ],
  relations: [{ id: 'r1', kind: 'association', source: 'Libro', target: 'Autor', style: { borderColor: '#ff0000' } }],
};

describe('contract: estilo por elemento y relación', () => {
  let h: McpHarness;
  let id: string;
  beforeEach(async () => {
    h = await createMcpHarness();
    id = (await h.call('create_diagram', diagram)).structuredContent!.diagramId as string;
  });
  afterEach(() => h.close());

  it('create_diagram conserva el estilo de elementos y relaciones', async () => {
    const d = await h.repo.get(id);
    expect(d?.elements.find((e) => e.id === 'Libro')?.style).toEqual(style);
    expect(d?.relations[0]?.style).toEqual({ borderColor: '#ff0000' });
  });

  it('apply_changes cambia y quita el estilo', async () => {
    const res = await h.call('apply_changes', {
      operations: [
        { op: 'update_element', id: 'Autor', changes: { style: { fillColor: '#ffffff' } } },
        { op: 'update_relation', id: 'r1', changes: { style: null } },
      ],
    });
    expect(res.isError).toBeFalsy();
    const d = await h.repo.get(id);
    expect(d?.elements.find((e) => e.id === 'Autor')?.style).toEqual({ fillColor: '#ffffff' });
    expect(d?.relations[0]).not.toHaveProperty('style');
  });

  it('un color inválido da SCHEMA_VIOLATION con path y hint', async () => {
    const res = await h.call('apply_changes', {
      operations: [{ op: 'update_element', id: 'Libro', changes: { style: { fillColor: 'rojo' } } }],
    });
    expect(h.errorCodes(res)).toEqual(['SCHEMA_VIOLATION']);
    expect(res.structuredContent!.errors![0]).toMatchObject({ path: '/operations/0/changes/style/fillColor' });
    expect(res.structuredContent!.errors![0]!.hint).toBeTruthy();
  });

  it('una fuente o tamaño inválidos al crear dan SCHEMA_VIOLATION', async () => {
    const bad = { ...diagram, elements: [{ ...diagram.elements[0], style: { fontFamily: 'Comic Sans', fontSize: 100 } }, diagram.elements[1]] };
    const res = await h.call('create_diagram', bad);
    expect(h.errorCodes(res)).toEqual(['SCHEMA_VIOLATION', 'SCHEMA_VIOLATION']);
    expect(res.structuredContent!.errors!.map((e) => e.path).sort()).toEqual(['/elements/0/style/fontFamily', '/elements/0/style/fontSize']);
  });

  it('el grosor del estilo se guarda en el elemento y la relación, y se exporta', async () => {
    const res = await h.call('apply_changes', {
      operations: [
        { op: 'update_element', id: 'Autor', changes: { style: { borderColor: '#112233', lineWidth: 'thick' } } },
        { op: 'update_relation', id: 'r1', changes: { style: { borderColor: '#ff0000', lineWidth: 'thin' } } },
      ],
    });
    expect(res.isError).toBeFalsy();
    const d = await h.repo.get(id);
    expect(d?.elements.find((e) => e.id === 'Autor')?.style).toEqual({ borderColor: '#112233', lineWidth: 'thick' });
    expect(d?.relations[0]?.style).toEqual({ borderColor: '#ff0000', lineWidth: 'thin' });

    const exported = async (format: string) => (await h.call('export_diagram', { format })).structuredContent!.content as string;
    expect(await exported('svg')).toContain('stroke="#112233" stroke-width="3"');
    const drawio = await exported('drawio');
    expect(drawio.match(/<mxCell id="Autor"[^>]*style="([^"]*)"/)![1]).toContain('strokeWidth=3;');
    expect(drawio.match(/<mxCell id="r1"[^>]*style="([^"]*)"/)![1]).toContain('strokeWidth=1;');
    const excalidraw = JSON.parse(await exported('excalidraw'));
    expect(excalidraw.elements.find((e: { id: string }) => e.id === 'Autor')).toMatchObject({ strokeWidth: 3 });
    expect(excalidraw.elements.find((e: { id: string }) => e.id === 'r1')).toMatchObject({ strokeWidth: 1 });
  });

  it('un grosor inválido da SCHEMA_VIOLATION con path y hint', async () => {
    const res = await h.call('apply_changes', {
      operations: [{ op: 'update_element', id: 'Libro', changes: { style: { lineWidth: 'enorme' } } }],
    });
    expect(h.errorCodes(res)).toEqual(['SCHEMA_VIOLATION']);
    expect(res.structuredContent!.errors![0]).toMatchObject({ path: '/operations/0/changes/style/lineWidth' });
    expect(res.structuredContent!.errors![0]!.hint).toBeTruthy();
  });

  it('el grosor del lápiz (fino, medio, grueso) se guarda en el trazo y se exporta', async () => {
    for (const [name, width] of Object.entries(DRAWING_WIDTH_PX)) {
      const res = await h.call('apply_changes', {
        operations: [{ op: 'add_element', element: { id: `trazo-${name}`, kind: 'drawing', name: 'Trazo', points: [{ x: 2, y: 3 }, { x: 40, y: 25 }], strokeColor: '#1f2933', strokeWidth: width, layout: { x: 10, y: 10 } } }],
      });
      expect(res.isError, name).toBeFalsy();
    }
    const d = await h.repo.get(id);
    expect(d?.elements.flatMap((e) => (e.kind === 'drawing' ? [e.strokeWidth] : []))).toEqual([1.5, 2.5, 5]);
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('stroke-width="5"');
  });

  it('el esquema de las herramientas expone style con fuentes y rango', async () => {
    const tools = (await h.client.listTools()).tools;
    const json = JSON.stringify(tools.find((t) => t.name === 'apply_changes')!.inputSchema);
    expect(json).toContain('"fontFamily"');
    expect(json).toContain('"minimum":8');
    expect(json).toContain('"maximum":48');
    expect(json).toContain('"lineWidth"');
    expect(json).toContain('"thick"');
    for (const font of FONT_FAMILIES) expect(json).toContain(font);
  });

  it('la guía chartsia://schema/{type} documenta el estilo', async () => {
    const res = await h.client.readResource({ uri: 'chartsia://schema/class' });
    const text = (res.contents[0] as { text: string }).text;
    expect(text).toContain('## Estilo');
    expect(text).toContain('#rrggbb');
    expect(text).toContain('lineWidth');
    for (const font of FONT_FAMILIES) expect(text).toContain(font);
  });
});
