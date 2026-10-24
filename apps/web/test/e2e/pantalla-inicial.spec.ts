import { type APIRequestContext } from '@playwright/test';
import { library } from './support/fake-agent';
import { direccionDe } from './support/rutas';
import { expect, test } from './support/fixtures';

/** Borra todos los diagramas del hub para partir sin ninguno. */
async function vaciarHub(request: APIRequestContext) {
  const { diagrams } = (await (await request.get('/api/diagrams')).json()) as { diagrams: { diagramId: string }[] };
  for (const d of diagrams) await request.delete(`/api/diagrams/${d.diagramId}`);
}

test.describe('pantalla inicial', () => {
  test('sin diagramas aparece la pantalla inicial y Empezar abre un diagrama en blanco', async ({ page, request }) => {
    await vaciarHub(request);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'ChartsIA' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Star on GitHub' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Integraciones' }).getByRole('article', { name: 'Codex CLI' })).toBeVisible();

    await page.getByRole('button', { name: 'Empezar' }).click();
    const ventana = page.getByRole('dialog', { name: 'Nuevo diagrama' });
    await expect(ventana).toBeVisible();
    await ventana.getByLabel('Título').fill('Primero');
    await ventana.getByRole('button', { name: 'Crear' }).click();
    await expect(page).toHaveURL(/\/d\/primero-/);
  });

  test('si un agente crea el primer diagrama, la app pasa de la pantalla inicial al diagrama', async ({ page, request, agent }) => {
    await vaciarHub(request);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'ChartsIA' })).toBeVisible();
    const id = await agent.create({ ...library, title: 'Desde el agente' });
    await expect(page).toHaveURL(direccionDe(id));
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('con diagramas, la portada va directo al diagrama', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Reciente' });
    await page.goto('/');
    await expect(page).toHaveURL(direccionDe(id));
    await expect(page.getByRole('heading', { level: 1, name: 'ChartsIA' })).toHaveCount(0);
  });
});
