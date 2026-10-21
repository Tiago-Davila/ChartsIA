import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('barra lateral con proyectos', () => {
  test('el diagrama asignado va en su sección, los demás en "Sin proyecto", y se pliega', async ({ page, agent, request }) => {
    const enProyecto = await agent.create({ ...library, title: 'Dentro del proyecto' });
    await agent.create({ ...library, title: 'Suelto' });
    await page.goto('/');
    const lista = page.getByRole('navigation', { name: 'Diagramas' });
    await expect(lista.getByRole('button', { name: /Suelto/ })).toBeVisible();

    const creado = await request.post('/api/projects', { data: { name: 'Mi proyecto' } });
    const proyecto = (await creado.json()) as { id: string };
    await request.put(`/api/diagrams/${enProyecto}/project`, { data: { projectId: proyecto.id } });

    const titulo = lista.getByRole('button', { name: /Mi proyecto/ });
    const seccion = lista.locator('li.diagram-list__section', { hasText: 'Mi proyecto' });
    await expect(seccion.getByRole('button', { name: /Dentro del proyecto/ })).toBeVisible();
    const sinProyecto = lista.locator('li.diagram-list__section', { hasText: 'Sin proyecto' });
    await expect(sinProyecto.getByRole('button', { name: /Suelto/ })).toBeVisible();
    await expect(sinProyecto.getByRole('button', { name: /Dentro del proyecto/ })).toHaveCount(0);

    await titulo.click();
    await expect(titulo).toHaveAttribute('aria-expanded', 'false');
    await expect(lista.getByRole('button', { name: /Dentro del proyecto/ })).toHaveCount(0);
  });
});
