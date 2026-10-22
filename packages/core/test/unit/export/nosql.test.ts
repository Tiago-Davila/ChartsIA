import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';
import { type Diagram, DiagramInputSchema } from '../../../src/model/index.js';

const input = {
  type: 'nosql',
  title: 'Pedidos',
  elements: [
    {
      id: 'Pedidos',
      kind: 'collection',
      name: 'pedidos',
      fields: [
        { path: ['cliente'], type: 'object' },
        { path: ['cliente', 'nombre'], type: 'string' },
        { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
        { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
        { path: ['cliente', 'direcciones', 'ciudad'], type: 'string' },
      ],
    },
    { id: 'Clientes', kind: 'collection', name: 'clientes', fields: [{ path: ['nombre'], type: 'string' }] },
  ],
  relations: [{ id: 'ref', kind: 'nosql-rel', source: 'Pedidos', target: 'Clientes', label: 'clienteId' }],
};

async function diagram(): Promise<Diagram> {
  const base = DiagramInputSchema.parse(input);
  return layoutDiagram({
    ...base,
    id: 'dg_goldengolden',
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  });
}

describe('exportación de diagramas NoSQL', () => {
  it('conserva cajas y textos anidados en SVG, draw.io y Excalidraw', async () => {
    const d = await diagram();
    const svg = exportDiagram(d, 'svg').content;
    const drawio = exportDiagram(d, 'drawio').content;
    const excalidraw = JSON.parse(exportDiagram(d, 'excalidraw').content) as {
      elements: { id: string; type: string; x: number; y: number; text?: string; parent?: string; groupIds: string[]; containerId?: string | null; strokeColor?: string; backgroundColor?: string }[];
    };

    expect(svg.match(/<rect\b/g)?.length).toBeGreaterThanOrEqual(7);
    expect(svg).toContain('cliente: object');
    expect(svg).toContain('direcciones: array&lt;object&gt;');
    expect(svg).toContain('calle: string');

    expect(drawio).toContain('kind="collection"');
    expect(drawio).toContain('parent="Pedidos"');
    expect(drawio).toContain('cliente: object');
    expect(drawio).toContain('direcciones: array&lt;object&gt;');
    expect(drawio).toContain('calle: string');

    const title = excalidraw.elements.find((element) => element.text === 'pedidos');
    const objectLabel = excalidraw.elements.find((element) => element.text === 'cliente: object');
    const arrayLabel = excalidraw.elements.find((element) => element.text === 'direcciones: array<object>');
    const nestedBoxes = excalidraw.elements.filter((element) => element.type === 'rectangle' && element.id.startsWith('Pedidos-nosql-'));
    const root = excalidraw.elements.find((element) => element.id === 'Pedidos');

    expect(title).toBeDefined();
    expect(objectLabel).toBeDefined();
    expect(arrayLabel).toBeDefined();
    expect(nestedBoxes.length).toBeGreaterThanOrEqual(2);
    expect(root).toBeDefined();
    expect(title!.y).toBeLessThan(objectLabel!.y);
    expect(title!.groupIds).toEqual(root!.groupIds);
    expect(title!.containerId).toBeNull();
    for (const shape of excalidraw.elements.filter((element) => element.type === 'rectangle')) {
      expect(shape.strokeColor).not.toBe('none');
      expect(shape.backgroundColor).not.toBe('none');
    }
  });
});
