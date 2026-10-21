import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FONT_FAMILIES } from '@chartsia/core/model';
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

  it('el esquema de las herramientas expone style con fuentes y rango', async () => {
    const tools = (await h.client.listTools()).tools;
    const json = JSON.stringify(tools.find((t) => t.name === 'apply_changes')!.inputSchema);
    expect(json).toContain('"fontFamily"');
    expect(json).toContain('"minimum":8');
    expect(json).toContain('"maximum":48');
    for (const font of FONT_FAMILIES) expect(json).toContain(font);
  });

  it('la guía chartsia://schema/{type} documenta el estilo', async () => {
    const res = await h.client.readResource({ uri: 'chartsia://schema/class' });
    const text = (res.contents[0] as { text: string }).text;
    expect(text).toContain('## Estilo');
    expect(text).toContain('#rrggbb');
    for (const font of FONT_FAMILIES) expect(text).toContain(font);
  });
});
