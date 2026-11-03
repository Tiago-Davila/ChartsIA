import { describe, expect, it } from 'vitest';
import { exportSvg } from '../../../src/export/index.js';
import { layoutDiagram, relayoutDiagram } from '../../../src/layout/index.js';
import { DEFAULT_PREFERENCES, type Diagram, type DiagramInput, mergePreferences, type PreferenceChanges, withPreferences } from '../../../src/model/index.js';
import { applyOperations } from '../../../src/operations/index.js';

const META = { id: 'dg_aaaaaaaaaaaa', revision: 1, createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' };

function cadena(): DiagramInput {
  return {
    type: 'class',
    title: 'Cadena',
    elements: ['A', 'B', 'C'].map((id) => ({ id, kind: 'class' as const, name: id, attributes: [{ name: 'x', type: 'int', visibility: '+' as const }], operations: [] })),
    relations: [
      { id: 'r1', kind: 'association', source: 'A', target: 'B', sourceMultiplicity: '1', targetMultiplicity: '*' },
      { id: 'r2', kind: 'association', source: 'B', target: 'C' },
    ],
  };
}

function hermanos(): DiagramInput {
  return {
    type: 'class',
    title: 'Hermanos',
    elements: ['A', 'B', 'C'].map((id) => ({ id, kind: 'class' as const, name: id, attributes: [], operations: [] })),
    relations: [
      { id: 'r1', kind: 'association', source: 'A', target: 'B' },
      { id: 'r2', kind: 'association', source: 'A', target: 'C' },
    ],
  };
}

const withPrefs = (input: DiagramInput, changes: PreferenceChanges): Diagram => ({ ...withPreferences(input, mergePreferences(DEFAULT_PREFERENCES, changes)), ...META });
const pos = (d: Diagram, id: string) => d.elements.find((e) => e.id === id)!.layout!;
const right = (d: Diagram, id: string) => pos(d, id).x + pos(d, id).width!;
const bottom = (d: Diagram, id: string) => pos(d, id).y + pos(d, id).height!;

describe('layout con preferencias', () => {
  it('las preferencias por defecto dan el mismo layout que sin preferencias', async () => {
    const sin = await layoutDiagram({ ...cadena(), ...META });
    const con = await layoutDiagram(withPrefs(cadena(), {}));
    expect(con.elements).toEqual(sin.elements);
    expect(con.relations).toEqual(sin.relations);
  });

  it('down apila los elementos en vertical y right en horizontal', async () => {
    const down = await layoutDiagram(withPrefs(cadena(), { direction: 'down' }));
    expect(pos(down, 'B').y).toBeGreaterThan(bottom(down, 'A'));
    const horizontal = await layoutDiagram(withPrefs(cadena(), { direction: 'right' }));
    expect(pos(horizontal, 'B').x).toBeGreaterThan(right(horizontal, 'A'));
  });

  it('más espacio entre capas separa más los elementos', async () => {
    const gap = async (layerSpacing: 'compact' | 'normal' | 'wide') => {
      const d = await layoutDiagram(withPrefs(cadena(), { layerSpacing }));
      return pos(d, 'B').y - bottom(d, 'A');
    };
    const [compact, normal, wide] = [await gap('compact'), await gap('normal'), await gap('wide')];
    expect(compact).toBeLessThan(normal);
    expect(normal).toBeLessThan(wide);
  });

  it('más espacio entre elementos separa los de una misma capa', async () => {
    const gap = async (elementSpacing: 'compact' | 'wide') => {
      const d = await layoutDiagram(withPrefs(hermanos(), { elementSpacing }));
      return pos(d, 'C').x - right(d, 'B');
    };
    expect(await gap('compact')).toBeLessThan(await gap('wide'));
  });

  it('con las mismas preferencias el layout es idéntico byte a byte', async () => {
    const changes = { direction: 'right', elementSpacing: 'wide', layerSpacing: 'compact' } as const;
    const a = await layoutDiagram(withPrefs(cadena(), changes));
    const b = await layoutDiagram(withPrefs(cadena(), changes));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('el layout incremental conserva las preferencias y no mueve a los existentes', async () => {
    const previous = await layoutDiagram(withPrefs(cadena(), { direction: 'right' }));
    const added = applyOperations(previous, [
      { op: 'add_element', element: { id: 'D', kind: 'class', name: 'D', attributes: [], operations: [] } },
      { op: 'add_relation', relation: { id: 'r3', kind: 'association', source: 'C', target: 'D' } },
    ]);
    if (!added.ok) throw new Error(JSON.stringify(added.errors));
    const { diagram } = await relayoutDiagram(previous, added.diagram);
    expect(diagram.preferences?.direction).toBe('right');
    for (const id of ['A', 'B', 'C']) expect(pos(diagram, id)).toEqual(pos(previous, id));
    expect(pos(diagram, 'D')).toBeDefined();
  });
});

describe('detalle UML y leyenda', () => {
  it('ocultar el detalle UML quita tipos, visibilidad y multiplicidades', async () => {
    const full = exportSvg(await layoutDiagram(withPrefs(cadena(), {})));
    const minimal = exportSvg(await layoutDiagram(withPrefs(cadena(), { uml: { types: false, visibility: false, multiplicities: false } })));
    expect(full).toContain('+ x: int');
    expect(full).toContain('>*<');
    expect(minimal).toContain('>x<');
    expect(minimal).not.toContain('int');
    expect(minimal).not.toContain('>*<');
  });

  it('ocultar los métodos quita su compartimento', async () => {
    const withMethod = (changes: PreferenceChanges) => {
      const d = withPrefs(cadena(), changes);
      return layoutDiagram({ ...d, elements: d.elements.map((e) => (e.kind === 'class' ? { ...e, operations: [{ name: 'run', parameters: [], visibility: '+' as const }] } : e)) });
    };
    const shown = await withMethod({});
    const hidden = await withMethod({ uml: { methods: false } });
    expect(pos(hidden, 'A').height).toBeLessThan(pos(shown, 'A').height!);
    expect(exportSvg(shown)).toContain('+ run()');
    expect(exportSvg(hidden)).not.toContain('run()');
  });

  it('la leyenda C4 se puede quitar', async () => {
    const c4 = (changes: PreferenceChanges) => {
      const input: DiagramInput = { type: 'c4-container', title: 'C4', elements: [{ id: 'P', kind: 'person', name: 'Ana' }], relations: [] };
      return layoutDiagram(withPrefs(input, changes));
    };
    expect(exportSvg(await c4({}))).toContain('Leyenda');
    expect(exportSvg(await c4({ c4Legend: false }))).not.toContain('Leyenda');
  });
});
