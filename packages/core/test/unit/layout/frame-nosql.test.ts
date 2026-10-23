import { expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram, relayoutDiagram } from '../../../src/layout/index.js';
import { applyOperations } from '../../../src/operations/index.js';
import { validateDiagram } from '../../../src/validation/index.js';

it('mueve y desagrupa una colección NoSQL dentro de un marco conservando sus campos', async () => {
  const checked = validateDiagram({
    type: 'nosql', title: 'Pedidos en un marco',
    elements: [
      { id: 'Marco', kind: 'frame', name: 'Pedidos', layout: { x: 0, y: 0 } },
      { id: 'Pedidos', kind: 'collection', name: 'pedidos', parentId: 'Marco', fields: [
        { path: ['cliente'], type: 'object' },
        { path: ['cliente', 'nombre'], type: 'string' },
      ] },
    ],
    relations: [],
  });
  expect(checked.ok).toBe(true);
  if (!checked.ok) return;
  const before = await layoutDiagram({ ...checked.value, id: 'dg_aaaaaaaaaaaa', revision: 0, createdAt: '', updatedAt: '' });
  const frame = before.elements.find((element) => element.id === 'Marco')!.layout!;
  const collection = before.elements.find((element) => element.id === 'Pedidos')!;
  const moved = applyOperations(before, [{ op: 'move_element', id: 'Marco', x: frame.x + 60, y: frame.y + 40 }]);
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  const { diagram: after } = await relayoutDiagram(before, moved.diagram);
  const placed = after.elements.find((element) => element.id === 'Pedidos')!;
  expect(placed.layout).toMatchObject({ x: collection.layout!.x + 60, y: collection.layout!.y + 40 });
  expect(placed.kind === 'collection' && placed.fields).toEqual(collection.kind === 'collection' && collection.fields);
  const exported = JSON.parse(exportDiagram(after, 'excalidraw').content) as { elements: { id: string; groupIds: string[] }[] };
  expect(exported.elements.find((element) => element.id === 'Pedidos')!.groupIds).toEqual(['Pedidos-group', 'Marco-frame']);
  const ungrouped = applyOperations(after, [{ op: 'remove_element', id: 'Marco', cascade: 'reparent' }]);
  expect(ungrouped.ok).toBe(true);
  if (!ungrouped.ok) return;
  const { diagram: final } = await relayoutDiagram(after, ungrouped.diagram);
  const released = final.elements.find((element) => element.id === 'Pedidos')!;
  expect(released.parentId).toBeUndefined();
  expect(released.layout).toMatchObject({ x: placed.layout!.x, y: placed.layout!.y });
});
