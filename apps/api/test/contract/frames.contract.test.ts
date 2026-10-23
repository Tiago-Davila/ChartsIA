import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGM4H2zxX6NsxX8AE2IEn6hGtYAAAAAASUVORK5CYII=';

describe('contract: marcos', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea y mueve un marco universal por MCP, lo exporta y permite desagrupar', async () => {
    const created = await h.call('create_diagram', {
      type: 'class',
      title: 'Elementos agrupados',
      elements: [
        { id: 'Marco', kind: 'frame', name: 'Servicios', layout: { x: 100, y: 100, width: 400, height: 300 } },
        { id: 'Figura', kind: 'figure', name: 'Figura', shape: 'circle', parentId: 'Marco', layout: { x: 140, y: 160, width: 60, height: 60 } },
        { id: 'Trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 0, y: 0 }, { x: 40, y: 20 }], strokeColor: '#b42318', strokeWidth: 2, parentId: 'Marco', layout: { x: 220, y: 170, width: 40, height: 20 } },
        { id: 'Logo', kind: 'image', name: 'Logo', src: png, parentId: 'Marco', layout: { x: 300, y: 160, width: 40, height: 20 } },
      ],
      relations: [],
    });
    expect(created.isError).toBeFalsy();
    const id = created.structuredContent!.diagramId as string;
    const before = await h.repo.get(id);
    const positions = new Map(before!.elements.map((element) => [element.id, element.layout]));

    const moved = await h.call('apply_changes', {
      diagramId: id,
      operations: [
        { op: 'update_element', id: 'Marco', changes: { name: 'Servicios nuevos' } },
        { op: 'move_element', id: 'Marco', x: positions.get('Marco')!.x + 80, y: positions.get('Marco')!.y + 45 },
      ],
    });
    expect(moved.isError).toBeFalsy();
    const afterMove = await h.repo.get(id);
    const frame = afterMove!.elements.find((element) => element.id === 'Marco')!;
    expect(frame.name).toBe('Servicios nuevos');
    for (const childId of ['Figura', 'Trazo', 'Logo']) {
      const child = afterMove!.elements.find((element) => element.id === childId)!;
      expect(child.parentId).toBe('Marco');
      expect(child.layout!.x).toBe(positions.get(childId)!.x! + 80);
      expect(child.layout!.y).toBe(positions.get(childId)!.y! + 45);
    }

    const svg = (await h.call('export_diagram', { diagramId: id, format: 'svg' })).structuredContent!.content as string;
    const drawio = (await h.call('export_diagram', { diagramId: id, format: 'drawio' })).structuredContent!.content as string;
    const excalidraw = JSON.parse((await h.call('export_diagram', { diagramId: id, format: 'excalidraw' })).structuredContent!.content as string);
    expect(svg).toContain('Servicios nuevos');
    expect(drawio).toMatch(/<mxCell id="Figura"[^>]*parent="Marco"/);
    expect(drawio).toContain('container=1');
    expect(excalidraw.elements.find((element: { id: string }) => element.id === 'Figura')?.groupIds).toEqual(['Marco-frame']);
    expect(excalidraw.elements.find((element: { id: string }) => element.id === 'Trazo')?.groupIds).toEqual(['Marco-frame']);
    expect(excalidraw.elements.find((element: { id: string }) => element.id === 'Logo')?.groupIds).toEqual(['Marco-frame']);

    const ungrouped = await h.call('apply_changes', {
      diagramId: id,
      operations: [
        ...['Figura', 'Trazo', 'Logo'].map((childId) => ({ op: 'update_element', id: childId, changes: { parentId: null } })),
        { op: 'remove_element', id: 'Marco' },
      ],
    });
    expect(ungrouped.isError).toBeFalsy();
    const final = await h.repo.get(id);
    expect(final!.elements.some((element) => element.kind === 'frame')).toBe(false);
    for (const childId of ['Figura', 'Trazo', 'Logo']) expect(final!.elements.find((element) => element.id === childId)?.parentId).toBeUndefined();
  });
});
