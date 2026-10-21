import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('título editable', () => {
  test('doble clic cambia el título en la barra y en la lista, y Ctrl+Z lo revierte', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Título viejo' });
    await page.goto(`/d/${id}`);
    await page.getByRole('heading', { name: /Título viejo/ }).dblclick();
    const input = page.getByRole('textbox', { name: 'Título del diagrama' });
    await input.fill('Título nuevo');
    await input.press('Enter');
    await expect(page.getByRole('heading', { name: /Título nuevo/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Diagramas' }).getByText('Título nuevo')).toBeVisible();

    await page.keyboard.press('Control+z');
    await expect(page.getByRole('heading', { name: /Título viejo/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Diagramas' }).getByText('Título viejo')).toBeVisible();
  });
});
