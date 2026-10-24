import { direccionDe } from './support/rutas';
import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('eliminar un diagrama desde la lista', () => {
  test('Cancelar no borra; Eliminar lo quita de la lista y del hub, también tras recargar', async ({ page, agent, request }) => {
    const id = await agent.create({ ...library, title: 'Para borrar' });
    await agent.create({ ...library, title: 'Se queda' });
    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    await expect(lista.getByText('Para borrar')).toBeVisible();

    await lista.getByRole('button', { name: 'Opciones de Para borrar' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar…' }).click();
    const ventana = page.getByRole('dialog', { name: 'Eliminar diagrama' });
    await expect(ventana).toContainText('¿Eliminar «Para borrar»?');
    await ventana.getByRole('button', { name: 'Cancelar' }).click();
    await expect(ventana).toHaveCount(0);
    await expect(lista.getByText('Para borrar')).toBeVisible();

    await lista.getByRole('button', { name: 'Opciones de Para borrar' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar…' }).click();
    await page.getByRole('dialog', { name: 'Eliminar diagrama' }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(lista.getByText('Para borrar')).toHaveCount(0);
    await expect(lista.getByText('Se queda')).toBeVisible();

    await page.reload();
    await expect(lista.getByText('Se queda')).toBeVisible();
    await expect(lista.getByText('Para borrar')).toHaveCount(0);
    expect((await request.get(`/api/diagrams/${id}`)).status()).toBe(404);
  });

  test('borrar el diagrama abierto pasa al más reciente de los que quedan', async ({ page, agent }) => {
    const abierto = await agent.create({ ...library, title: 'Abierto' });
    const otro = await agent.create({ ...library, title: 'Otro' });
    await page.goto(`/d/${abierto}`);
    await expect(page.getByRole('heading', { name: /Abierto/ })).toBeVisible();

    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    await lista.getByRole('button', { name: 'Opciones de Abierto' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar…' }).click();
    await page.getByRole('dialog', { name: 'Eliminar diagrama' }).getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByRole('heading', { name: /Abierto/ })).toHaveCount(0);
    await expect(lista.getByText('Abierto')).toHaveCount(0);
    await expect(page).toHaveURL(direccionDe(otro));
  });

  test('un agente que borra por MCP el diagrama abierto hace que la app lo deje', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Borrado por el agente' });
    await page.goto(`/d/${id}`);
    await expect(page.getByRole('heading', { name: /Borrado por el agente/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Conectado al hub' })).toBeVisible();

    expect((await agent.call('delete_diagram', { diagramId: id })).isError).toBeFalsy();

    await expect(page.getByRole('heading', { name: /Borrado por el agente/ })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Diagramas' }).getByText('Borrado por el agente')).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).pathname).not.toContain(id.replace(/^dg_/, ''));
  });
});
