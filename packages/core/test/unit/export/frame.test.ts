import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';
import { type Diagram, DiagramInputSchema } from '../../../src/model/index.js';
import { elementPrimitives, framePadding, measureElement } from '../../../src/shapes/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { pngDataUrl } from '../../support/images.js';

async function nestedFrames(): Promise<Diagram> {
  const parsed = validateDiagram({
    type: 'class',
    title: 'Marcos',
    elements: [
      { id: 'outer', kind: 'frame', name: 'Marco exterior', layout: { x: 0, y: 0, width: 500, height: 400 } },
      { id: 'inner', kind: 'frame', name: 'Marco interior', parentId: 'outer', layout: { x: 60, y: 70, width: 300, height: 220 } },
      { id: 'A', kind: 'class', name: 'Pedido', attributes: [], operations: [], parentId: 'inner', layout: { x: 100, y: 120, width: 100, height: 60 } },
      { id: 'F', kind: 'figure', name: 'Figura', shape: 'circle', parentId: 'outer', layout: { x: 25, y: 100, width: 50, height: 50 } },
      { id: 'D', kind: 'drawing', name: 'Trazo', points: [{ x: 0, y: 0 }, { x: 24, y: 14 }], strokeColor: '#b42318', strokeWidth: 2, parentId: 'inner', layout: { x: 220, y: 180, width: 40, height: 30 } },
      { id: 'I', kind: 'image', name: 'Logo', src: pngDataUrl(), parentId: 'inner', layout: { x: 280, y: 180, width: 40, height: 30 } },
    ],
    relations: [],
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const valid = DiagramInputSchema.parse(parsed.value);
  return layoutDiagram({
    ...valid,
    id: 'dg_aaaaaaaaaaaa', revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
  });
}

describe('frame', () => {
  it('mide un título y lo dibuja como el slot editable name', () => {
    const frame: Extract<Diagram['elements'][number], { kind: 'frame' }> = { id: 'f', kind: 'frame', name: 'Un marco con título largo' };
    const size = measureElement(frame);
    const title = elementPrimitives(frame, size).find((primitive) => primitive.type === 'text');
    expect(size.width).toBeGreaterThan(160);
    expect(title).toMatchObject({ text: 'Un marco con título largo', slot: 'name', bold: true });
  });

  it('deja espacio para un título grande antes del contenido del marco', () => {
    const frame: Extract<Diagram['elements'][number], { kind: 'frame' }> = { id: 'f', kind: 'frame', name: 'Texto grande', style: { fontSize: 48 } };
    const padding = framePadding(frame.style);
    const size = measureElement(frame);
    const title = elementPrimitives(frame, size).find((primitive) => primitive.type === 'text')!;
    expect(padding.top).toBeGreaterThanOrEqual(title.y + 15);
    expect(size.height).toBe(padding.top + padding.bottom);
  });

  it('exporta grupos anidados en draw.io y mantiene membresía de grupo en Excalidraw', async () => {
    const diagram = await nestedFrames();
    const drawio = exportDiagram(diagram, 'drawio').content;
    expect(drawio).toContain('id="outer"');
    expect(drawio).toContain('id="inner"');
    expect(drawio).toMatch(/<mxCell id="inner"[^>]*parent="outer"/);
    expect(drawio).toMatch(/<mxCell id="A"[^>]*parent="inner"/);

    const excalidraw = JSON.parse(exportDiagram(diagram, 'excalidraw').content) as { elements: { id: string; groupIds: string[] }[] };
    const byId = new Map(excalidraw.elements.map((element) => [element.id, element]));
    expect(byId.get('inner')?.groupIds).toEqual(['inner-frame', 'outer-frame']);
    expect(byId.get('inner-title')?.groupIds).toEqual(['inner-frame', 'outer-frame']);
    expect(byId.get('A')?.groupIds).toEqual(['A-group', 'inner-frame', 'outer-frame']);
    expect(byId.get('D')?.groupIds).toEqual(['inner-frame', 'outer-frame']);
    expect(byId.get('I')?.groupIds).toEqual(['inner-frame', 'outer-frame']);
  });
});
