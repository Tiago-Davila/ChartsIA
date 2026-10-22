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

  it.each(['class', 'c4-context', 'c4-container', 'c4-component', 'er', 'nosql'])('se permiten en un diagrama %s', async (type) => {
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

  it('crea, actualiza y exporta trazos drawing mediante MCP', async () => {
    const created = await h.call('create_diagram', {
      type: 'class', title: 'Lápiz',
      elements: [{ id: 'trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 2, y: 3 }, { x: 40, y: 25 }, { x: 70, y: 50 }], strokeColor: '#b42318', strokeWidth: 3 }],
      relations: [],
    });
    expect(created.isError).toBeFalsy();

    const updated = await h.call('apply_changes', {
      operations: [{ op: 'update_element', id: 'trazo', changes: { points: [{ x: 5, y: 6 }, { x: 45, y: 30 }], strokeColor: '#175cd3', strokeWidth: 4 } }],
    });
    expect(updated.isError).toBeFalsy();

    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    const drawio = (await h.call('export_diagram', { format: 'drawio' })).structuredContent!.content as string;
    const excalidraw = JSON.parse((await h.call('export_diagram', { format: 'excalidraw' })).structuredContent!.content as string);
    expect(svg).toContain('stroke="#175cd3"');
    expect(drawio).toContain('strokeColor=#175cd3;strokeWidth=4;');
    expect(drawio).toContain('as="sourcePoint"');
    expect(excalidraw.elements.find((e: { id: string }) => e.id === 'trazo')).toMatchObject({ type: 'line', strokeColor: '#175cd3', strokeWidth: 4 });
  });

  it('crea, convierte y exporta un marcador semitransparente mediante MCP', async () => {
    const created = await h.call('create_diagram', {
      type: 'class', title: 'Marcador',
      elements: [
        { id: 'zona', kind: 'drawing', name: 'Zona', points: [{ x: 7, y: 7 }, { x: 90, y: 12 }], strokeColor: '#facc15', strokeWidth: 14, highlighter: true },
        { id: 'figura', kind: 'figure', name: 'Figura', shape: 'circle' },
      ],
      relations: [],
    });
    expect(created.isError).toBeFalsy();

    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('stroke="#facc15" stroke-width="14" stroke-opacity="0.4"');
    expect(svg.indexOf('data-id="zona"')).toBeLessThan(svg.indexOf('data-id="figura"'));
    const drawio = (await h.call('export_diagram', { format: 'drawio' })).structuredContent!.content as string;
    expect(drawio).toContain('strokeWidth=14;opacity=40;');
    const excalidraw = JSON.parse((await h.call('export_diagram', { format: 'excalidraw' })).structuredContent!.content as string);
    expect(excalidraw.elements.find((e: { id: string }) => e.id === 'zona')).toMatchObject({ type: 'line', opacity: 40 });

    const pen = await h.call('apply_changes', { operations: [{ op: 'update_element', id: 'zona', changes: { highlighter: null } }] });
    expect(pen.isError).toBeFalsy();
    const opaque = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(opaque).not.toContain('stroke-opacity');
  });

  it('rechaza highlighter distinto de true', async () => {
    const res = await h.call('create_diagram', {
      type: 'class', title: 'Marcador',
      elements: [{ id: 'zona', kind: 'drawing', name: 'Zona', points: [{ x: 7, y: 7 }, { x: 90, y: 12 }], strokeColor: '#facc15', strokeWidth: 14, highlighter: false }],
      relations: [],
    });
    expect(h.errorCodes(res)).toContain('SCHEMA_VIOLATION');
  });

  it('acepta el óvalo, el rombo y el paralelogramo al crear y al cambiar de forma', async () => {
    const res = await h.call('create_diagram', {
      type: 'er', title: 'Nuevas formas',
      elements: [
        { id: 'o', kind: 'figure', name: 'Óvalo', shape: 'oval' },
        { id: 'r', kind: 'figure', name: 'Rombo', shape: 'diamond' },
      ],
      relations: [],
    });
    expect(res.isError).toBeFalsy();
    const changed = await h.call('apply_changes', { operations: [{ op: 'update_element', id: 'r', changes: { shape: 'parallelogram' } }] });
    expect(changed.isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('Óvalo');
    expect(svg).toContain('Rombo');
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
      expect(text).toContain('`drawing`');
      expect(text).toContain('1024');
      expect(text).toContain('highlighter');
    }
  });
});
