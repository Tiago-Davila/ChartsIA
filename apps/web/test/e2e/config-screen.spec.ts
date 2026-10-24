import { direccionDe } from './support/rutas';
import { FakeAgent, library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('pantalla de configuración', () => {
  test('desde el lienzo se llega con el engranaje, muestra la URL del MCP y se vuelve', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Para configurar' });
    await page.goto(`/d/${id}`);
    await expect(page.locator('.react-flow')).toBeVisible();

    await page.getByRole('button', { name: 'Configuración' }).click();
    await expect(page).toHaveURL(/\/config$/);
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Recientes' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Conexiones MCP' }).click();
    await expect(page).toHaveURL(/\/config\/mcp$/);
    await expect(page.getByText(`${new URL(page.url()).origin}/mcp`, { exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Claude Code (HTTP)' })).toBeVisible();

    await page.getByRole('button', { name: 'Volver al lienzo' }).click();
    await expect(page).toHaveURL(direccionDe(id));
    await expect(page.locator('.react-flow')).toBeVisible();
  });
});

test('el botón de copiar prompt deja en el portapapeles el prompt con la URL del MCP', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/config/mcp');
  await page.getByRole('article', { name: 'Claude Code (HTTP)' }).getByRole('button', { name: 'Conectar' }).click();
  await page.getByRole('button', { name: 'Copiar prompt de Claude Code (HTTP)' }).click();
  await expect(page.getByText('Copiado')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`${baseURL}/mcp`);
});

test('un agente que se conecta aparece en /config sin recargar', async ({ page, baseURL }) => {
  await page.goto('/config/mcp');
  await expect(page.getByRole('heading', { name: 'Conexiones MCP' })).toBeVisible();
  await expect(page.getByText('agente-en-vivo')).toHaveCount(0);

  const agent = await new FakeAgent(baseURL!, 'agente-en-vivo').connect();
  await expect(page.getByRole('listitem').filter({ hasText: 'agente-en-vivo v1.0.0' })).toBeVisible();
  await agent.close();
});
