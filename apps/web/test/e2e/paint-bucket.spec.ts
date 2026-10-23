import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

type WithStyle = { id: string; style?: Record<string, unknown> };
const estiloDe = async (agent: { layout(id: string): Promise<unknown> }, id: string, elemento: string) =>
  ((await agent.layout(id)) as { elements: WithStyle[] }).elements.find((e) => e.id === elemento)?.style;

test('el balde pinta varias figuras seguidas sin abrir el panel de estilo y persiste al recargar', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Balde' });
  await page.goto(`/d/${id}`);

  await page.getByRole('button', { name: 'Balde', exact: true }).click();
  await page.getByLabel('Color del balde').fill('#16a34a');

  await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
  await page.locator('[data-element-id="Libro"]').click({ position: { x: 20, y: 8 } });

  await expect.poll(() => estiloDe(agent, id, 'Autor')).toEqual({ fillColor: '#16a34a' });
  await expect.poll(() => estiloDe(agent, id, 'Libro')).toEqual({ fillColor: '#16a34a' });
  await expect(page.getByRole('region', { name: 'Estilo' })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-element-id="Autor"] rect[fill="#16a34a"]').first()).toBeVisible();
  await expect(page.locator('[data-element-id="Libro"] rect[fill="#16a34a"]').first()).toBeVisible();
});
