import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';
import type { Diagram, Style } from '../../../src/model/index.js';
import { buildScene } from '../../../src/render/index.js';

const STYLE: Style = { borderColor: '#b42318', fillColor: '#fee4e2', fontColor: '#7a271a', fontFamily: 'monospace', fontSize: 20 };
const REL_STYLE: Style = { borderColor: '#175cd3', fillColor: '#d1e9ff', fontColor: '#175cd3', fontFamily: 'serif', fontSize: 16 };

async function diagram(style?: Style, relationStyle?: Style): Promise<Diagram> {
  return layoutDiagram({
    id: 'dg_aaaaaaaaaaaa', type: 'class', title: 'Estilo', revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
    elements: [
      { id: 'A', kind: 'class', name: 'Pedido', attributes: [{ name: 'total', type: 'double', visibility: '-' }], operations: [], ...(style ? { style } : {}) },
      { id: 'B', kind: 'class', name: 'Linea', attributes: [], operations: [] },
    ],
    relations: [{ id: 'r', kind: 'composition', source: 'A', target: 'B', label: 'contiene', ...(relationStyle ? { style: relationStyle } : {}) }],
  });
}

describe('render con estilo', () => {
  it('la forma usa los colores y la familia del estilo', async () => {
    const scene = buildScene(await diagram(STYLE));
    const node = scene.nodes.find((n) => n.id === 'A')!;
    expect(node.primitives[0]).toMatchObject({ type: 'rect', fill: '#fee4e2', stroke: '#b42318' });
    const name = node.primitives.find((p) => p.type === 'text' && p.slot === 'name');
    expect(name).toMatchObject({ color: '#7a271a', fontFamily: 'monospace', size: 20 });
  });

  it('sin estilo la forma conserva los valores por defecto', async () => {
    const node = buildScene(await diagram()).nodes.find((n) => n.id === 'A')!;
    expect(node.primitives[0]).toMatchObject({ fill: '#fffef5', stroke: '#1f2933' });
    expect(node.primitives.find((p) => p.type === 'text')).not.toHaveProperty('fontFamily');
  });

  it('la relación usa borderColor en la línea y fillColor en el rombo', async () => {
    const edge = buildScene(await diagram(undefined, REL_STYLE)).edges[0]!;
    expect(edge.primitives[0]).toMatchObject({ type: 'path', stroke: '#175cd3' });
    expect(edge.primitives[1]).toMatchObject({ type: 'path', fill: '#d1e9ff', stroke: '#175cd3' });
    expect(edge.primitives.find((p) => p.type === 'text')).toMatchObject({ color: '#175cd3', fontFamily: 'serif', size: Math.round((11 * 16) / 14) });
  });

  it('sin fillColor el rombo relleno usa el color de la línea', async () => {
    const edge = buildScene(await diagram(undefined, { borderColor: '#175cd3' })).edges[0]!;
    expect(edge.primitives[1]).toMatchObject({ fill: '#175cd3' });
  });
});

describe('grosor de trazo', () => {
  it('la forma dibuja su borde con el grosor del estilo y sin estilo usa el normal', async () => {
    for (const [lineWidth, px] of [['thin', 1], ['medium', 1.5], ['thick', 3]] as const) {
      const node = buildScene(await diagram({ lineWidth })).nodes.find((n) => n.id === 'A')!;
      expect(node.primitives[0], lineWidth).toMatchObject({ type: 'rect', strokeWidth: px });
    }
    const sin = buildScene(await diagram()).nodes.find((n) => n.id === 'A')!;
    expect(sin.primitives[0]).toMatchObject({ strokeWidth: 1.5 });
  });

  it('la relación engrosa la línea y sus marcadores juntos', async () => {
    const edge = buildScene(await diagram(undefined, { lineWidth: 'thick' })).edges[0]!;
    expect(edge.primitives[0]).toMatchObject({ type: 'path', strokeWidth: 3 });
    expect(edge.primitives[1]).toMatchObject({ type: 'path', strokeWidth: 3 });
  });

  it('svg: el grosor aparece en la forma y en la línea', async () => {
    const svg = exportDiagram(await diagram({ lineWidth: 'thick' }, { lineWidth: 'thin' }), 'svg').content;
    expect(svg).toContain('stroke="#1f2933" stroke-width="3"');
    expect(svg).toContain('stroke-width="1"');
  });

  it('drawio: strokeWidth en la forma y en la relación, sin repetir claves', async () => {
    const xml = exportDiagram(await diagram({ lineWidth: 'thick' }, { lineWidth: 'thin' }), 'drawio').content;
    const cell = xml.match(/<mxCell id="A"[^>]*style="([^"]*)"/)![1]!;
    expect(cell).toContain('strokeWidth=3;');
    expect(cell.match(/strokeWidth=/g)).toHaveLength(1);
    const edge = xml.match(/<mxCell id="r"[^>]*style="([^"]*)"/)![1]!;
    expect(edge).toContain('strokeWidth=1;');
  });

  it('drawio: sin grosor no agrega strokeWidth', async () => {
    const xml = exportDiagram(await diagram(STYLE), 'drawio').content;
    expect(xml.match(/<mxCell id="A"[^>]*style="([^"]*)"/)![1]).not.toContain('strokeWidth=');
  });

  it('excalidraw: strokeWidth en la forma, los separadores y la flecha', async () => {
    const json = JSON.parse(exportDiagram(await diagram({ lineWidth: 'thick' }, { lineWidth: 'thick' }), 'excalidraw').content);
    const byId = (id: string) => json.elements.find((e: { id: string }) => e.id === id);
    expect(byId('A')).toMatchObject({ strokeWidth: 3 });
    expect(byId('A-sep-0')).toMatchObject({ strokeWidth: 3 });
    expect(byId('r')).toMatchObject({ strokeWidth: 3 });
  });

  it('excalidraw: sin grosor conserva el de siempre', async () => {
    const json = JSON.parse(exportDiagram(await diagram(STYLE), 'excalidraw').content);
    expect(json.elements.find((e: { id: string }) => e.id === 'A')).toMatchObject({ strokeWidth: 1 });
  });
});

describe('exportación con estilo', () => {
  it('svg: colores y familia en los elementos y en la relación', async () => {
    const svg = exportDiagram(await diagram(STYLE, REL_STYLE), 'svg').content;
    expect(svg).toContain('fill="#fee4e2" stroke="#b42318"');
    expect(svg).toContain('fill="#7a271a" font-family="&apos;JetBrains Mono&apos;, Consolas, &apos;Courier New&apos;, monospace"');
    expect(svg).toContain('stroke="#175cd3"');
    expect(svg).toContain('fill="#d1e9ff"');
    expect(svg).toContain('font-family="Georgia, &apos;Times New Roman&apos;, serif"');
  });

  it('svg: sin estilo no aparece ninguna familia propia', async () => {
    const svg = exportDiagram(await diagram(), 'svg').content;
    expect(svg.match(/font-family=/g)).toHaveLength(1);
  });

  it('svg: es determinista con estilo', async () => {
    const d = await diagram(STYLE, REL_STYLE);
    expect(exportDiagram(d, 'svg').content).toBe(exportDiagram(d, 'svg').content);
  });

  it('drawio: el estilo sustituye los valores por defecto sin repetir claves', async () => {
    const xml = exportDiagram(await diagram(STYLE, REL_STYLE), 'drawio').content;
    const cell = xml.match(/<mxCell id="A"[^>]*style="([^"]*)"/)![1]!;
    expect(cell).toContain('strokeColor=#b42318;');
    expect(cell).toContain('fillColor=#fee4e2;');
    expect(cell).toContain('swimlaneFillColor=#fee4e2;');
    expect(cell).toContain('fontColor=#7a271a;');
    expect(cell).toContain('fontFamily=Courier New;');
    expect(cell).toContain('fontSize=20;');
    expect(cell.match(/strokeColor=/g)).toHaveLength(1);
    expect(cell.match(/fontSize=/g)).toHaveLength(1);
    const edge = xml.match(/<mxCell id="r"[^>]*style="([^"]*)"/)![1]!;
    expect(edge).toContain('strokeColor=#175cd3;');
    expect(edge).toContain('fontColor=#175cd3;');
    expect(edge).toContain('fontFamily=Times New Roman;');
    expect(edge).toContain('fontSize=13;');
  });

  it('drawio: los miembros de la clase llevan color, familia y tamaño pero no relleno ni borde', async () => {
    const xml = exportDiagram(await diagram(STYLE), 'drawio').content;
    const member = xml.match(/<mxCell id="A:attribute:0"[^>]*style="([^"]*)"/)![1]!;
    expect(member).toContain('strokeColor=none;fillColor=none;');
    expect(member).toContain('fontColor=#7a271a;fontFamily=Courier New;fontSize=19;');
  });

  it('excalidraw: color, relleno, familia numérica y tamaño', async () => {
    const json = JSON.parse(exportDiagram(await diagram(STYLE, REL_STYLE), 'excalidraw').content);
    const byId = (id: string) => json.elements.find((e: { id: string }) => e.id === id);
    expect(byId('A')).toMatchObject({ strokeColor: '#b42318', backgroundColor: '#fee4e2' });
    expect(byId('A-label')).toMatchObject({ strokeColor: '#7a271a', fontFamily: 3, fontSize: 20 });
    expect(byId('A-attribute:0')).toMatchObject({ strokeColor: '#7a271a', fontFamily: 3, fontSize: 19 });
    expect(byId('A-sep-0')).toMatchObject({ strokeColor: '#b42318' });
    expect(byId('r')).toMatchObject({ strokeColor: '#175cd3' });
    expect(byId('r-label')).toMatchObject({ strokeColor: '#175cd3', fontFamily: 2 });
  });

  it('excalidraw: sin estilo conserva Excalifont', async () => {
    const json = JSON.parse(exportDiagram(await diagram(), 'excalidraw').content);
    const label = json.elements.find((e: { id: string }) => e.id === 'A-label');
    expect(label).toMatchObject({ fontFamily: 5, strokeColor: '#1e1e1e', fontSize: 14 });
  });
});
