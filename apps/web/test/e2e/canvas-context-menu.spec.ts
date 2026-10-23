import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('menú contextual del lienzo', () => {
  test('clic derecho abre el menú y Escape o un clic afuera lo cierran', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Menú' });
    await page.goto(`/d/${id}`);
    const menu = page.getByRole('menu');

    await page.locator('[data-element-id="Autor"]').click({ button: 'right', position: { x: 20, y: 8 } });
    await expect(menu.getByRole('menuitem', { name: 'Duplicar' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Borrar' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    await page.locator('[data-element-id="Autor"]').click({ button: 'right', position: { x: 20, y: 8 } });
    await expect(menu).toBeVisible();
    await page.mouse.click(40, 400);
    await expect(menu).toHaveCount(0);
  });

  test('Duplicar copia la selección en una operación que Ctrl+Z deshace', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Duplicar menú' });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Autor"]').click({ button: 'right', position: { x: 20, y: 8 } });
    await page.getByRole('menuitem', { name: 'Duplicar' }).click();
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Autor_copia');

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).not.toContain('Autor_copia');
  });

  test('Borrar elimina toda la selección, aunque el clic derecho sea sobre una de sus clases', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Borrar menú' });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.locator('[data-element-id="Socio"]').click({ position: { x: 20, y: 8 }, modifiers: ['Control'] });
    await page.locator('[data-element-id="Autor"]').click({ button: 'right', position: { x: 20, y: 8 } });
    await page.getByRole('menuitem', { name: 'Borrar' }).click();

    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id).sort()).toEqual(['Libro', 'Prestamo']);
  });
});
