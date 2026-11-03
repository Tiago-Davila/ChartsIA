import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '@chartsia/core/model';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const diagram = {
  type: 'class',
  title: 'Cadena',
  elements: [
    { id: 'A', kind: 'class', name: 'A', attributes: [{ name: 'x', type: 'int', visibility: '-' }], operations: [{ name: 'run', parameters: [], visibility: '+' }] },
    { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
  ],
  relations: [{ id: 'r1', kind: 'association', source: 'A', target: 'B', targetMultiplicity: '*' }],
};

type Doc = { preferences?: unknown; elements: { id: string; layout: { x: number; width: number }; style?: unknown }[]; relations: { style?: unknown }[] };

describe('contract: set_preferences', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  const diagramOf = async (id: string) => (await h.call('get_diagram', { diagramId: id, includeLayout: true })).structuredContent as Doc;

  it('sin cambios devuelve las preferencias por defecto', async () => {
    const res = await h.call('set_preferences', {});
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual(DEFAULT_PREFERENCES);
  });

  it('guarda solo lo pedido, lo conserva entre llamadas y lo escribe en config.json', async () => {
    await h.call('set_preferences', { direction: 'right', uml: { methods: false } });
    const res = await h.call('set_preferences', { elementSpacing: 'wide', palette: { class: { fillColor: '#fde68a' } } });
    expect(res.structuredContent).toMatchObject({
      direction: 'right',
      elementSpacing: 'wide',
      layerSpacing: 'normal',
      uml: { types: true, visibility: true, multiplicities: true, methods: false },
      palette: { class: { fillColor: '#fde68a' } },
    });
    const file = JSON.parse(await readFile(h.config.configFile, 'utf8'));
    expect(file.diagrams).toEqual(res.structuredContent);
    expect((await h.call('set_preferences', { palette: { class: null } })).structuredContent).toMatchObject({ palette: {} });
  });

  it('rechaza campos y valores inválidos con SCHEMA_VIOLATION', async () => {
    for (const bad of [{ direction: 'up' }, { espaciado: 'wide' }, { uml: { colores: true } }, { palette: { circle: {} } }, { palette: { class: { fillColor: 'rojo' } } }]) {
      expect(h.errorCodes(await h.call('set_preferences', bad)), JSON.stringify(bad)).toEqual(['SCHEMA_VIOLATION']);
    }
  });

  it('los diagramas nuevos usan las preferencias y las guardan', async () => {
    await h.call('set_preferences', { direction: 'right', fontFamily: 'serif', palette: { class: { fillColor: '#fde68a' } } });
    const id = (await h.call('create_diagram', diagram)).structuredContent!.diagramId as string;
    const d = await diagramOf(id);
    expect(d.preferences).toMatchObject({ direction: 'right', fontFamily: 'serif' });
    const [a, b] = d.elements as [Doc['elements'][number], Doc['elements'][number]];
    expect(b.layout.x).toBeGreaterThan(a.layout.x + a.layout.width);
    expect(a.style).toEqual({ fontFamily: 'serif', fillColor: '#fde68a' });
    expect(d.relations[0]!.style).toEqual({ fontFamily: 'serif' });
  });

  it('un diagrama existente no cambia al modificar las preferencias', async () => {
    const id = (await h.call('create_diagram', diagram)).structuredContent!.diagramId as string;
    const before = await diagramOf(id);
    await h.call('set_preferences', { direction: 'right', layerSpacing: 'wide', fontFamily: 'monospace', uml: { types: false } });
    expect(await diagramOf(id)).toEqual(before);
    await h.call('apply_changes', { diagramId: id, operations: [{ op: 'set_title', title: 'Otro' }] });
    const after = await diagramOf(id);
    expect(after.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(after.elements.map((e) => e.layout)).toEqual(before.elements.map((e) => e.layout));
  });

  it('lo que se agrega a un diagrama creado con preferencias recibe su estilo', async () => {
    await h.call('set_preferences', { palette: { class: { borderColor: '#92400e' } } });
    const id = (await h.call('create_diagram', diagram)).structuredContent!.diagramId as string;
    await h.call('set_preferences', { palette: { class: null } });
    const res = await h.call('apply_changes', {
      diagramId: id,
      operations: [{ op: 'add_element', element: { id: 'C', kind: 'class', name: 'C', attributes: [], operations: [] } }],
    });
    expect(res.isError).toBeFalsy();
    const d = await diagramOf(id);
    expect(d.elements.find((e) => e.id === 'C')!.style).toEqual({ borderColor: '#92400e' });
  });

  it('el detalle UML y la leyenda C4 llegan al SVG exportado', async () => {
    await h.call('set_preferences', { uml: { types: false, visibility: false, multiplicities: false, methods: false } });
    const id = (await h.call('create_diagram', diagram)).structuredContent!.diagramId as string;
    const svg = (await h.call('export_diagram', { diagramId: id, format: 'svg' })).structuredContent!.content as string;
    expect(svg).not.toMatch(/int|run|>\*</);
    expect(svg).toContain('>x<');

    await h.call('set_preferences', { c4Legend: false });
    const c4 = { type: 'c4-context', title: 'C4', elements: [{ id: 'P', kind: 'person', name: 'Ana' }], relations: [] };
    const c4Id = (await h.call('create_diagram', c4)).structuredContent!.diagramId as string;
    expect(((await h.call('export_diagram', { diagramId: c4Id, format: 'svg' })).structuredContent!.content as string)).not.toContain('Leyenda');
  });
});
