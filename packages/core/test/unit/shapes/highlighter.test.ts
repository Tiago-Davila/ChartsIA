import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';
import { type Diagram, DiagramInputSchema, ElementSchema, isHighlighter } from '../../../src/model/index.js';
import { buildScene } from '../../../src/render/scene.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';
import { validateDiagram } from '../../../src/validation/index.js';

const marker = {
  id: 'Marcador',
  kind: 'drawing',
  name: 'Marcador',
  points: [{ x: 7, y: 7 }, { x: 90, y: 12 }],
  strokeColor: '#facc15',
  strokeWidth: 14,
  highlighter: true,
} as const;

async function diagramWithMarker(): Promise<Diagram> {
  const parsed = validateDiagram({
    type: 'class',
    title: 'Marcador',
    elements: [
      { id: 'Alfa', kind: 'figure', name: 'Figura', shape: 'circle', layout: { x: 0, y: 0 } },
      { ...marker, id: 'Marca', name: 'Marca', layout: { x: 0, y: 0 } },
    ],
    relations: [],
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return layoutDiagram({
    ...DiagramInputSchema.parse(parsed.value),
    id: 'dg_aaaaaaaaaaaa', revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
  });
}

describe('marcador', () => {
  it('es un trazo con highlighter: true y rechaza otros valores', () => {
    expect(ElementSchema.safeParse(marker).success).toBe(true);
    expect(ElementSchema.safeParse({ ...marker, highlighter: false }).success).toBe(false);
    expect(isHighlighter(marker)).toBe(true);
    expect(isHighlighter({ kind: 'drawing' })).toBe(false);
    expect(isHighlighter({ kind: 'figure', highlighter: true })).toBe(false);
  });

  it('se dibuja semitransparente y el lápiz sigue opaco', () => {
    const element = ElementSchema.parse(marker);
    expect(elementPrimitives(element, measureElement(element))[0]).toMatchObject({ strokeWidth: 14, strokeOpacity: 0.4 });
    const pen = ElementSchema.parse({ ...marker, highlighter: undefined });
    expect(elementPrimitives(pen, measureElement(pen))[0]).not.toHaveProperty('strokeOpacity');
  });

  it('se pinta detrás de las figuras en la escena aunque su id sea anterior', async () => {
    expect(buildScene(await diagramWithMarker()).nodes.map((n) => n.id)).toEqual(['Marca', 'Alfa']);
  });

  it('se exporta con transparencia y detrás de las figuras en SVG, draw.io y Excalidraw', async () => {
    const diagram = await diagramWithMarker();
    const svg = exportDiagram(diagram, 'svg').content;
    expect(svg).toContain('stroke-opacity="0.4"');
    expect(svg.indexOf('data-id="Marca"')).toBeLessThan(svg.indexOf('data-id="Alfa"'));

    const drawio = exportDiagram(diagram, 'drawio').content;
    expect(drawio).toContain('strokeWidth=14;opacity=40;');
    expect(drawio.indexOf('id="Marca"')).toBeLessThan(drawio.indexOf('id="Alfa"'));

    const excalidraw = JSON.parse(exportDiagram(diagram, 'excalidraw').content).elements as { id: string; opacity: number }[];
    expect(excalidraw.find((e) => e.id === 'Marca')).toMatchObject({ opacity: 40, strokeWidth: 14 });
    expect(excalidraw.find((e) => e.id === 'Alfa')!.opacity).toBe(100);
    expect(excalidraw.findIndex((e) => e.id === 'Marca')).toBeLessThan(excalidraw.findIndex((e) => e.id === 'Alfa'));
  });
});
