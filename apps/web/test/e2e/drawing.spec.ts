import { expect, test } from './support/fixtures';

type Drawing = {
  id: string;
  kind: string;
  points: { x: number; y: number }[];
  strokeColor: string;
  strokeWidth: number;
  layout: { x: number; y: number };
};

async function drawing(
  agent: {
    call(
      name: string,
      args?: Record<string, unknown>,
    ): Promise<{ structuredContent?: Record<string, unknown> }>;
  },
  id: string,
): Promise<Drawing | undefined> {
  const result = await agent.call('get_diagram', { diagramId: id, includeLayout: true });
  const elements = result.structuredContent?.elements as Drawing[] | undefined;
  return elements?.find((element) => element.kind === 'drawing');
}

test('el lápiz persiste un trazo, permite moverlo y borrarlo', async ({ page, agent }) => {
  const id = await agent.create({
    type: 'class',
    title: 'Lápiz',
    elements: [{ id: 'Clase', kind: 'class', name: 'Clase', attributes: [], operations: [] }],
    relations: [],
  });
  await page.goto(`/d/${id}`);
  await page.getByRole('button', { name: 'Lápiz', exact: true }).click();
  await expect(page.getByLabel('Color del lápiz')).toHaveValue('#1f2933');

  const classNode = page.locator('[data-element-id="Clase"]');
  const classBox = (await classNode.boundingBox())!;
  const classBefore = (await agent.layout(id)).elements.find(
    (element) => element.id === 'Clase',
  )!.layout;
  const start = { x: classBox.x + 10, y: classBox.y + 12 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    classBox.x + Math.min(classBox.width - 10, 70),
    classBox.y + classBox.height - 12,
    { steps: 8 },
  );
  await page.mouse.up();

  await expect
    .poll(async () => (await drawing(agent, id))?.points.length ?? 0)
    .toBeGreaterThanOrEqual(2);
  const saved = (await drawing(agent, id))!;
  expect(saved).toMatchObject({ kind: 'drawing', strokeColor: '#1f2933', strokeWidth: 2.5 });
  expect(saved.points.length).toBeLessThanOrEqual(1024);
  expect(
    (await agent.layout(id)).elements.find((element) => element.id === 'Clase')!.layout,
  ).toEqual(classBefore);

  await page.reload();
  const node = page.locator(`[data-element-id="${saved.id}"]`);
  await expect(node).toBeVisible();
  const beforeX = (await drawing(agent, id))!.layout.x;
  await node.locator('svg path').click({ position: { x: 20, y: 14 } });
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + 21, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 91, box.y + 65, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await drawing(agent, id))?.layout.x).not.toBe(beforeX);

  await page.locator(`[data-element-id="${saved.id}"]`).click({ position: { x: 21, y: 15 } });
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await drawing(agent, id))?.id).toBeUndefined();
});
