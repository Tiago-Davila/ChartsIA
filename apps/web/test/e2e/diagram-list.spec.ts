import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('barra lateral con muchos diagramas', () => {
  test('con 50 diagramas hace scroll, filtra y muestra el título completo', async ({ page, agent }) => {
    for (let i = 1; i <= 50; i++) {
      await agent.create({ ...library, title: `Lista ${String(i).padStart(2, '0')} con un título bastante largo` });
    }
    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    const items = lista.getByRole('button');
    await expect(items.nth(49)).toBeAttached();

    const scroll = lista.locator('ul');
    expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    await expect(items.first()).toHaveAttribute('title', /^Lista \d+ con un título bastante largo$/);

    await lista.getByLabel('Buscar diagramas por título').fill('LISTA 07');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveAttribute('title', 'Lista 07 con un título bastante largo');
  });
});
