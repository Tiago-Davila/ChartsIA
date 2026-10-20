import { shop } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('US2 · escenario 4: C4 de contenedores con límite, BD cilindro, etiquetas y leyenda', async ({ page, agent }) => {
  await page.goto('/');
  await agent.create(shop);
  await expect(page.getByText('Pasarela de pagos')).toBeVisible();

  // Límite con los contenedores dentro y el sistema externo fuera.
  const box = async (id: string) => (await page.locator(`[data-element-id="${id}"]`).boundingBox())!;
  const tienda = await box('tienda');
  for (const id of ['web', 'api', 'db']) {
    const b = await box(id);
    expect(b.x >= tienda.x && b.y >= tienda.y && b.x + b.width <= tienda.x + tienda.width + 1 && b.y + b.height <= tienda.y + tienda.height + 1).toBe(true);
  }
  const pagos = await box('pagos');
  expect(pagos.y >= tienda.y + tienda.height || pagos.x >= tienda.x + tienda.width || pagos.x + pagos.width <= tienda.x || pagos.y + pagos.height <= tienda.y).toBe(true);

  await expect(page.locator('[data-testid="shape-db"] ellipse')).toHaveCount(1);
  await expect(page.getByText('[Container: PostgreSQL]')).toBeVisible();
  await expect(page.getByText('Lee y escribe')).toBeVisible();
  await expect(page.getByText('[SQL]')).toBeVisible();
  await expect(page.getByText('[Software System - External]')).toBeVisible();

  const legend = page.getByRole('complementary', { name: 'Leyenda C4' });
  await expect(legend).toContainText('Persona');
  await expect(legend).toContainText('Contenedor');
  await expect(legend).toContainText('Externo');
});
