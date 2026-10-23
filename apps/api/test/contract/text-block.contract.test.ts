import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const TEXT = '# Notas\n\n**Importante** y *matiz*\n\n- uno\n\n```ts\nconst a = 1;\n```';

const blockDiagram = (type: string) => ({
  type,
  title: 'Texto',
  elements: [
    { id: 'nota', kind: 'text', name: TEXT, layout: { x: 40, y: 40 } },
    { id: 'figura', kind: 'figure', name: 'Figura', shape: 'circle' },
  ],
  relations: [],
});

describe('contract: bloque de texto', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it.each(['class', 'c4-context', 'c4-container', 'c4-component', 'er', 'nosql'])('se permite en un diagrama %s', async (type) => {
    const res = await h.call('create_diagram', blockDiagram(type));
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent!.counts).toEqual({ elements: 2, relations: 0 });
  });

  it('se exporta a SVG, draw.io y Excalidraw con su formato', async () => {
    expect((await h.call('create_diagram', blockDiagram('class'))).isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('>Notas</text>');
    expect(svg).toContain('#7c3aed');
    const drawio = (await h.call('export_diagram', { format: 'drawio' })).structuredContent!.content as string;
    expect(drawio).toContain('&lt;h1&gt;Notas&lt;/h1&gt;');
    expect(drawio).toContain('&lt;pre');
    const excalidraw = JSON.parse((await h.call('export_diagram', { format: 'excalidraw' })).structuredContent!.content as string);
    expect(excalidraw.elements.some((e: { type: string; text?: string }) => e.type === 'text' && e.text === 'Notas')).toBe(true);
  });

  it('cambia su contenido con apply_changes y el nuevo texto llega al SVG', async () => {
    expect((await h.call('create_diagram', blockDiagram('er'))).isError).toBeFalsy();
    const res = await h.call('apply_changes', { operations: [{ op: 'update_element', id: 'nota', changes: { name: '## Nuevo *título*' } }] });
    expect(res.isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('>Nuevo</text>');
    expect(svg).not.toContain('>Notas</text>');
  });

  it('rechaza un texto vacío y uno de más de 4000 caracteres', async () => {
    const empty = await h.call('create_diagram', { type: 'class', title: 'Vacío', elements: [{ id: 't', kind: 'text', name: '' }], relations: [] });
    expect(empty.isError).toBeTruthy();
    const long = await h.call('create_diagram', { type: 'class', title: 'Largo', elements: [{ id: 't', kind: 'text', name: 'x'.repeat(4001) }], relations: [] });
    expect(long.isError).toBeTruthy();
  });

  it('un nombre de más de 200 caracteres sigue siendo inválido en las demás clases de elemento', async () => {
    const res = await h.call('create_diagram', { type: 'class', title: 'Clase', elements: [{ id: 'c', kind: 'class', name: 'x'.repeat(201), attributes: [], operations: [] }], relations: [] });
    expect(res.isError).toBeTruthy();
  });
});
