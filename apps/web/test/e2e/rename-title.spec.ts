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

  test('desde el menú ⋯ renombra un diagrama no abierto sin abrirlo y persiste al recargar', async ({ page, agent }) => {
    const abierto = await agent.create({ ...library, title: 'Abierto' });
    await agent.create({ ...library, title: 'Para renombrar' });
    await page.goto(`/d/${abierto}`);
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    const url = page.url();

    await lista.getByRole('button', { name: 'Opciones de Para renombrar' }).click();
    await page.getByRole('menuitem', { name: 'Renombrar…' }).click();
    const ventana = page.getByRole('dialog', { name: 'Renombrar diagrama' });
    await expect(ventana.getByLabel('Nombre')).toHaveValue('Para renombrar');
    await ventana.getByLabel('Nombre').fill('Ya renombrado');
    await ventana.getByRole('button', { name: 'Renombrar' }).click();

    await expect(lista.getByText('Ya renombrado')).toBeVisible();
    await expect(lista.getByText('Para renombrar')).toHaveCount(0);
    expect(page.url()).toBe(url);
    await expect(page.getByRole('heading', { name: /Abierto/ })).toBeVisible();

    await page.reload();
    await expect(lista.getByText('Ya renombrado')).toBeVisible();
  });
});
