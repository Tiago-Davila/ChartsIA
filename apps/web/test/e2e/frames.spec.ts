import { expect, test } from './support/fixtures';

test.describe('marcos', () => {
  test('seleccionar, agrupar, mover, recargar y desagrupar conserva la posición de los hijos', async ({ page, agent }) => {
    const id = await agent.create({
      type: 'class',
      title: 'Marco editable',
      elements: [
        { id: 'Primera', kind: 'class', name: 'Primera', attributes: [], operations: [], layout: { x: 100, y: 100 } },
        { id: 'Segunda', kind: 'class', name: 'Segunda', attributes: [], operations: [], layout: { x: 500, y: 260 } },
      ],
      relations: [{ id: 'r1', kind: 'association', source: 'Primera', target: 'Segunda' }],
    });
    await page.goto(`/d/${id}`);
    const layout = () => agent.layout(id);
    const positions = async () => {
      const elements = (await layout()).elements;
      return new Map(elements.map((element) => [element.id, { x: element.layout.x, y: element.layout.y, parentId: element.parentId }]));
    };
    const beforeGroup = await positions();

    await page.locator('[data-element-id="Primera"]').click({ position: { x: 20, y: 8 } });
    await page.locator('[data-element-id="Segunda"]').click({ position: { x: 20, y: 8 }, modifiers: ['Control'] });
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
    await expect(page.locator('[data-testid="edge-r1"]')).toBeAttached();
    await page.getByRole('button', { name: 'Agrupar en marco' }).click();
    await expect.poll(async () => (await layout()).elements.find((element) => element.kind === 'frame')?.id).toBe('Marco');
    const grouped = await positions();
    expect(grouped.get('Primera')).toMatchObject({ ...beforeGroup.get('Primera'), parentId: 'Marco' });
    expect(grouped.get('Segunda')).toMatchObject({ ...beforeGroup.get('Segunda'), parentId: 'Marco' });

    await page.getByText('Marco', { exact: true }).dblclick();
    const titleEditor = page.getByRole('textbox', { name: 'Editar texto' });
    await titleEditor.fill('Servicios');
    await titleEditor.press('Enter');
    await expect.poll(async () => (await layout()).elements.find((element) => element.id === 'Marco')?.name).toBe('Servicios');
    await page.getByText('Servicios', { exact: true }).click();
    await expect(page.locator('.react-flow__node.selected[data-id="Marco"]')).toBeVisible();
    const titleBox = (await page.getByText('Servicios', { exact: true }).boundingBox())!;
    const from = { x: titleBox.x + titleBox.width / 2, y: titleBox.y + titleBox.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 80, from.y + 60, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await positions()).get('Marco')!.x).not.toBe(grouped.get('Marco')!.x);
    const moved = await positions();
    const dx = moved.get('Marco')!.x - grouped.get('Marco')!.x;
    const dy = moved.get('Marco')!.y - grouped.get('Marco')!.y;
    expect(dx).not.toBe(0);
    expect(dy).not.toBe(0);
    for (const child of ['Primera', 'Segunda']) {
      expect(moved.get(child)!.x).toBe(grouped.get(child)!.x + dx);
      expect(moved.get(child)!.y).toBe(grouped.get(child)!.y + dy);
    }

    await page.reload();
    await expect(page.locator('[data-element-id="Marco"]')).toBeVisible();
    const afterReload = await positions();
    expect((await layout()).elements.find((element) => element.id === 'Marco')?.name).toBe('Servicios');
    expect(afterReload.get('Primera')).toMatchObject({ ...moved.get('Primera'), parentId: 'Marco' });
    expect(afterReload.get('Segunda')).toMatchObject({ ...moved.get('Segunda'), parentId: 'Marco' });

    await page.getByText('Servicios', { exact: true }).click();
    await expect(page.locator('.react-flow__node.selected[data-id="Marco"]')).toBeVisible();
    await page.getByRole('button', { name: 'Desagrupar' }).click();
    await expect.poll(async () => (await layout()).elements.some((element) => element.kind === 'frame')).toBe(false);
    const ungrouped = await positions();
    for (const child of ['Primera', 'Segunda']) {
      expect(ungrouped.get(child)).toMatchObject({ ...moved.get(child)!, parentId: undefined });
    }

    await page.reload();
    await expect(page.locator('[data-element-id="Marco"]')).toHaveCount(0);
    await expect(page.locator('[data-element-id="Primera"]')).toBeVisible();
    await expect(page.locator('[data-element-id="Segunda"]')).toBeVisible();
  });

  test('seleccionar un grupo y su descendiente lo envuelve sin reparentar dos veces', async ({ page, agent }) => {
    const id = await agent.create({
      type: 'class',
      title: 'Selección anidada',
      elements: [
        { id: 'pkg', kind: 'package', name: 'Dominio' },
        { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [], parentId: 'pkg' },
        { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
      ],
      relations: [],
    });
    await page.goto(`/d/${id}`);
    await page.locator('[data-element-id="pkg"]').click({ position: { x: 24, y: 12 } });
    await page.locator('[data-element-id="A"]').click({ position: { x: 18, y: 8 }, modifiers: ['Control'] });
    await page.getByRole('button', { name: 'Agrupar en marco' }).click();
    await expect.poll(async () => (await agent.layout(id)).elements.find((element) => element.id === 'pkg')?.parentId).toBe('Marco');
    const elements = (await agent.layout(id)).elements;
    expect(elements.find((element) => element.id === 'A')?.parentId).toBe('pkg');
    expect(elements.find((element) => element.id === 'Marco')?.kind).toBe('frame');
  });
});
