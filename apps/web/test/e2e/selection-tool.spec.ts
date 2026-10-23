import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('la selección apaga el lápiz y luego selecciona con clic y con rectángulo', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Selección' });
  await page.goto(`/d/${id}`);

  const lapiz = page.getByRole('button', { name: 'Lápiz', exact: true });
  const seleccion = page.getByRole('button', { name: 'Selección', exact: true });
  await expect(seleccion).toHaveAttribute('aria-pressed', 'true');

  await lapiz.click();
  await expect(lapiz).toHaveAttribute('aria-pressed', 'true');
  await seleccion.click();
  await expect(lapiz).toHaveAttribute('aria-pressed', 'false');
  await expect(seleccion).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1);
  await expect(page.locator('.react-flow__node.selected[data-id="Autor"]')).toHaveCount(1);

  const libro = (await page.locator('.react-flow__node[data-id="Libro"]').boundingBox())!;
  const autor = (await page.locator('.react-flow__node[data-id="Autor"]').boundingBox())!;
  const esquina = { x: Math.min(libro.x, autor.x) - 30, y: Math.min(libro.y, autor.y) - 30 };
  const opuesta = { x: Math.max(libro.x + libro.width, autor.x + autor.width) + 30, y: Math.max(libro.y + libro.height, autor.y + autor.height) + 30 };
  await page.mouse.move(esquina.x, esquina.y);
  await page.mouse.down();
  await page.mouse.move(opuesta.x, opuesta.y, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('.react-flow__node.selected[data-id="Libro"]')).toHaveCount(1);
  await expect(page.locator('.react-flow__node.selected[data-id="Autor"]')).toHaveCount(1);
  expect((await agent.layout(id)).elements.some((element) => element.kind === 'drawing')).toBe(false);
});
