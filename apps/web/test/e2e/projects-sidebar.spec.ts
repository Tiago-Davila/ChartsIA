import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('barra lateral con proyectos', () => {
  test('el diagrama asignado va en su sección, los demás en "Sin proyecto", y se pliega', async ({ page, agent, request }) => {
    const enProyecto = await agent.create({ ...library, title: 'Dentro del proyecto' });
    await agent.create({ ...library, title: 'Suelto' });
    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    await expect(lista.locator('.diagram-list__item', { hasText: 'Suelto' })).toBeVisible();

    const creado = await request.post('/api/projects', { data: { name: 'Mi proyecto' } });
    const proyecto = (await creado.json()) as { id: string };
    await request.put(`/api/diagrams/${enProyecto}/project`, { data: { projectId: proyecto.id } });

    const titulo = lista.getByRole('button', { name: /Mi proyecto/ });
    const seccion = lista.locator('li.diagram-list__section', { hasText: 'Mi proyecto' });
    await expect(seccion.locator('.diagram-list__item', { hasText: 'Dentro del proyecto' })).toBeVisible();
    const sinProyecto = lista.locator('li.diagram-list__section', { hasText: 'Sin proyecto' });
    await expect(sinProyecto.locator('.diagram-list__item', { hasText: 'Suelto' })).toBeVisible();
    await expect(sinProyecto.locator('.diagram-list__item', { hasText: 'Dentro del proyecto' })).toHaveCount(0);

    await titulo.click();
    await expect(titulo).toHaveAttribute('aria-expanded', 'false');
    await expect(lista.locator('.diagram-list__item', { hasText: 'Dentro del proyecto' })).toHaveCount(0);
  });

  test('el menú ⋯ mueve un diagrama a un proyecto nuevo, persiste al recargar y lo quita', async ({ page, agent }) => {
    await agent.create({ ...library, title: 'Para mover' });
    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    const menu = lista.getByRole('button', { name: 'Opciones de Para mover' });
    await expect(menu).toHaveAttribute('aria-haspopup', 'menu');
    const url = page.url();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(page.url()).toBe(url);

    // Escape cierra el menú.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');

    page.once('dialog', (dialog) => void dialog.accept('Proyecto nuevo'));
    await menu.click();
    await page.getByRole('menuitem', { name: 'Nuevo proyecto…' }).click();
    const seccion = lista.locator('li.diagram-list__section', { hasText: 'Proyecto nuevo' });
    await expect(seccion.locator('.diagram-list__item', { hasText: 'Para mover' })).toBeVisible();

    await page.reload();
    await expect(seccion.locator('.diagram-list__item', { hasText: 'Para mover' })).toBeVisible();

    await lista.getByRole('button', { name: 'Opciones de Para mover' }).click();
    await page.getByRole('menuitem', { name: 'Quitar del proyecto' }).click();
    const sinProyecto = lista.locator('li.diagram-list__section', { hasText: 'Sin proyecto' });
    await expect(sinProyecto.locator('.diagram-list__item', { hasText: 'Para mover' })).toBeVisible();
  });
});
