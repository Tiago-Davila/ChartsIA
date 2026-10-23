import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('la mano desplaza la vista al arrastrar sobre una figura sin moverla ni seleccionarla', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Mano' });
  await page.goto(`/d/${id}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(4);

  await page.getByRole('button', { name: 'Mano', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mano', exact: true })).toHaveAttribute('aria-pressed', 'true');

  const autor = page.locator('[data-element-id="Autor"]');
  const nodo = page.locator('.react-flow__node').filter({ has: autor });
  const box = (await autor.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const delta = { x: -120, y: 60 };
  const layoutAntes = (await agent.layout(id)).elements.find((element) => element.id === 'Autor')!.layout;
  const viewport = page.locator('.react-flow__viewport');
  const viewportAntes = await viewport.getAttribute('style');

  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-element-id="Autor"]'), from)).toBe(true);
  await page.mouse.move(from.x, from.y);
  await expect(page.locator('.react-flow__pane')).toHaveCSS('cursor', 'grab');
  await expect(nodo).toHaveCSS('cursor', 'grab');

  await page.mouse.down();
  await expect(nodo).toHaveCSS('cursor', 'grabbing');
  await page.mouse.move(from.x + delta.x, from.y + delta.y, { steps: 10 });
  await page.mouse.up();

  await expect.poll(() => viewport.getAttribute('style')).not.toBe(viewportAntes);
  const boxDespues = (await autor.boundingBox())!;
  expect(boxDespues.x - box.x).toBeCloseTo(delta.x, 0);
  expect(boxDespues.y - box.y).toBeCloseTo(delta.y, 0);
  await expect(nodo).not.toHaveClass(/selected/);
  expect((await agent.layout(id)).elements.find((element) => element.id === 'Autor')!.layout).toEqual(layoutAntes);
});
