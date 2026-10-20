import { library, shop } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('Ajustar abre el diagrama editado por el agente y muestra el cambio', async ({ page, agent }) => {
  const biblioteca = await agent.create(library);
  const tienda = await agent.create(shop);
  await page.goto(`/d/${biblioteca}`);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();

  // El agente edita el otro diagrama; la app no lo recibe en vivo.
  await agent.apply([{ op: 'add_element', element: { id: 'Auditoria', kind: 'container', name: 'Auditoría', technology: 'Nest.js' } }], tienda);

  await page.getByRole('button', { name: 'Ajustar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/d/${tienda}$`));

  const nuevo = page.locator('[data-element-id="Auditoria"]');
  await expect(nuevo).toBeVisible();
  await expect
    .poll(async () => {
      const area = (await page.locator('.react-flow').boundingBox())!;
      const b = (await nuevo.boundingBox())!;
      return b.x >= area.x && b.y >= area.y && b.x + b.width <= area.x + area.width && b.y + b.height <= area.y + area.height;
    })
    .toBe(true);
});
