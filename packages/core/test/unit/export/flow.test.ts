import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';
import { type Diagram, DiagramInputSchema } from '../../../src/model/index.js';

const input = {
  type: 'flow',
  title: 'Pedido',
  elements: [
    { id: 'alta', kind: 'flow-node', variant: 'trigger', name: 'POST /orders', subtitle: 'Endpoint HTTP' },
    { id: 'datos', kind: 'flow-node', variant: 'database', name: 'orders' },
  ],
  relations: [
    { id: 'r1', kind: 'flow-edge', source: 'alta', target: 'datos', flowType: 'event', label: 'guarda' },
    { id: 'r2', kind: 'flow-edge', source: 'datos', target: 'alta', flowType: 'read' },
  ],
};

async function diagram(): Promise<Diagram> {
  return layoutDiagram({ ...DiagramInputSchema.parse(input), id: 'dg_goldengolden', revision: 1, createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' });
}

describe('exportación de flujos', () => {
  it('SVG dibuja tarjetas, textos y conexiones con su trazo', async () => {
    const svg = exportDiagram(await diagram(), 'svg').content;
    expect(svg).toContain('POST /orders');
    expect(svg).toContain('Endpoint HTTP');
    expect(svg).toContain('stroke-dasharray="8 4"');
    expect(svg).toContain('guarda');
  });

  it('draw.io lleva una celda por parte, el ícono como imagen y las conexiones con su estilo', async () => {
    const drawio = exportDiagram(await diagram(), 'drawio').content;
    expect(drawio).toContain('kind="flow-node"');
    expect(drawio).toContain('variant="trigger"');
    expect(drawio).toContain('id="alta-icon"');
    expect(drawio).toContain('image=data:image/svg+xml,');
    expect(drawio).not.toContain('svg+xml;base64');
    expect(drawio).toContain('parent="alta"');
    expect(drawio).toContain('dashed=1;dashPattern=8 4');
    expect(drawio).toContain('startArrow=open');
  });

  it('Excalidraw agrupa la tarjeta con su ícono y textos, y enlaza las flechas a la tarjeta', async () => {
    const file = JSON.parse(exportDiagram(await diagram(), 'excalidraw').content) as {
      elements: { id: string; type: string; text?: string; groupIds: string[]; strokeStyle?: string; startBinding?: { elementId: string } | null; startArrowhead?: string | null; endArrowhead?: string | null }[];
      files: Record<string, { mimeType: string }>;
    };
    const card = file.elements.find((e) => e.id === 'alta')!;
    const icon = file.elements.find((e) => e.id === 'alta-icon')!;
    const title = file.elements.find((e) => e.text === 'POST /orders')!;
    expect(icon.type).toBe('image');
    expect(icon.groupIds).toEqual(card.groupIds);
    expect(title.groupIds).toEqual(card.groupIds);
    expect(file.files['file_alta-icon']?.mimeType).toBe('image/svg+xml');
    const event = file.elements.find((e) => e.id === 'r1')!;
    expect(event).toMatchObject({ type: 'arrow', strokeStyle: 'dashed', startBinding: { elementId: 'alta' }, endArrowhead: 'arrow' });
    expect(file.elements.find((e) => e.id === 'r2')).toMatchObject({ startArrowhead: 'arrow', endArrowhead: null });
  });
});
