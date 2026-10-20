import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('deshacer y rehacer', () => {
  test('Ctrl+Z recupera una clase borrada y Ctrl+Y la vuelve a borrar', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Deshacer' });
    await page.goto(`/d/${id}`);
    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.keyboard.press('Delete');
    await expect(page.getByText('Autor', { exact: true })).toHaveCount(0);

    await page.keyboard.press('Control+z');
    await expect(page.getByText('Autor', { exact: true })).toBeVisible();
    await expect.poll(async () => (await agent.layout(id)).relations.map((r) => r.id)).toContain('r1');

    await page.keyboard.press('Control+y');
    await expect(page.getByText('Autor', { exact: true })).toHaveCount(0);
  });

  test('Ctrl+Z también deshace un cambio del agente', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Agente' });
    await page.goto(`/d/${id}`);
    await expect(page.getByText('Socio', { exact: true })).toBeVisible();
    await agent.apply([{ op: 'remove_element', id: 'Socio' }], id);
    await expect(page.getByText('Socio', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByText('Socio', { exact: true })).toBeVisible();
  });
});
