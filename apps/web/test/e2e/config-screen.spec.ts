import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('pantalla de configuración', () => {
  test('desde el lienzo se llega con el engranaje, muestra la URL del MCP y se vuelve', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Para configurar' });
    await page.goto(`/d/${id}`);
    await expect(page.locator('.react-flow')).toBeVisible();

    await page.getByRole('button', { name: 'Configuración' }).click();
    await expect(page).toHaveURL(/\/config$/);
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
    await expect(page.getByText(`${new URL(page.url()).origin}/mcp`, { exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Claude Code (HTTP)' })).toBeVisible();

    await page.getByRole('button', { name: '← Volver al lienzo' }).click();
    await expect(page).toHaveURL(new RegExp(`/d/${id}$`));
    await expect(page.locator('.react-flow')).toBeVisible();
  });
});
