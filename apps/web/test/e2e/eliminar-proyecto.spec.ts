import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('eliminar un proyecto', () => {
  test('Cancelar en la advertencia no borra el proyecto ni sus diagramas', async ({ page, agent, request }) => {
    const dentro = await agent.create({ ...library, title: 'Diagrama cancelar' });
    const proyecto = (await (await request.post('/api/projects', { data: { name: 'Proyecto Cancelable' } })).json()) as { id: string };
    await request.put(`/api/diagrams/${dentro}/project`, { data: { projectId: proyecto.id } });

    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    const seccion = lista.locator('li.diagram-list__section', { hasText: 'Proyecto Cancelable' });
    await expect(seccion.locator('.project-tree__item', { hasText: 'Diagrama cancelar' })).toBeVisible();

    await seccion.getByRole('button', { name: 'Opciones del proyecto' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar proyecto…' }).click();
    const ventana = page.getByRole('dialog', { name: 'Eliminar proyecto' });
    await expect(ventana).toContainText('Su diagrama pasa a «Sin proyecto».');
    await ventana.getByRole('button', { name: 'Cancelar' }).click();
    await expect(ventana).toHaveCount(0);

    await expect(seccion.locator('.project-tree__item', { hasText: 'Diagrama cancelar' })).toBeVisible();
    await page.reload();
    await expect(lista.locator('li.diagram-list__section', { hasText: 'Proyecto Cancelable' })).toBeVisible();
  });

  test('Mantener Eliminar borra el proyecto y sus diagramas siguen en la lista como "Sin proyecto"', async ({ page, agent, request }) => {
    const uno = await agent.create({ ...library, title: 'Diagrama borrar uno' });
    const dos = await agent.create({ ...library, title: 'Diagrama borrar dos' });
    const proyecto = (await (await request.post('/api/projects', { data: { name: 'Proyecto Borrable' } })).json()) as { id: string };
    await request.put(`/api/diagrams/${uno}/project`, { data: { projectId: proyecto.id } });
    await request.put(`/api/diagrams/${dos}/project`, { data: { projectId: proyecto.id } });

    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    const seccion = lista.locator('li.diagram-list__section', { hasText: 'Proyecto Borrable' });
    await expect(seccion.locator('.project-tree__item')).toHaveCount(2);

    await seccion.getByRole('button', { name: 'Opciones del proyecto' }).click();
    await page.getByRole('menuitem', { name: 'Eliminar proyecto…' }).click();
    const ventana = page.getByRole('dialog', { name: 'Eliminar proyecto' });
    await expect(ventana).toContainText('Sus 2 diagramas pasan a «Sin proyecto».');
    // Hay que mantener pulsado el botón para confirmar.
    await ventana.getByRole('button', { name: 'Mantener para eliminar' }).press('Enter', { delay: 1800 });
    await expect(ventana).toHaveCount(0);

    await expect(lista.locator('li.diagram-list__section', { hasText: 'Proyecto Borrable' })).toHaveCount(0);
    await expect(lista.locator('.diagram-list__item', { hasText: 'Diagrama borrar uno' })).toBeVisible();
    await expect(lista.locator('.diagram-list__item', { hasText: 'Diagrama borrar dos' })).toBeVisible();

    await page.reload();
    await expect(lista.locator('li.diagram-list__section', { hasText: 'Proyecto Borrable' })).toHaveCount(0);
    await expect(lista.locator('.diagram-list__item', { hasText: 'Diagrama borrar uno' })).toBeVisible();
    await expect(lista.locator('.diagram-list__item', { hasText: 'Diagrama borrar dos' })).toBeVisible();
  });
});
