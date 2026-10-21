import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('nuevo diagrama desde la app', () => {
  test('crea un diagrama vacío, aparece en la barra lateral y queda abierto', async ({ page, agent }) => {
    const existente = await agent.create({ ...library, title: 'Existente' });
    await page.goto(`/d/${existente}`);
    const lista = page.getByRole('navigation', { name: 'Diagramas' });

    await page.getByRole('button', { name: 'Nuevo diagrama' }).click();
    const formulario = page.getByRole('form', { name: 'Nuevo diagrama' });
    await formulario.getByLabel('Tipo').selectOption('er');
    await formulario.getByLabel('Título').fill('Mi diagrama nuevo');
    await formulario.getByRole('button', { name: 'Crear' }).click();

    await expect(page.getByRole('heading', { name: /Mi diagrama nuevo/ })).toBeVisible();
    const nuevo = lista.getByRole('button', { name: /Mi diagrama nuevo/ });
    await expect(nuevo).toHaveAttribute('aria-current', 'page');
    await expect(nuevo).toContainText('Entidad-relación');
    await expect(page).toHaveURL(/\/d\/dg_/);
    expect(page.url()).not.toContain(existente);

    await page.reload();
    await expect(nuevo).toBeVisible();
  });
});
