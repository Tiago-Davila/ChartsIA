import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

type WithStyle = { id: string; style?: Record<string, unknown> };
const estiloDe = async (agent: { layout(id: string): Promise<unknown> }, id: string, elemento: string) =>
  ((await agent.layout(id)) as { elements: WithStyle[] }).elements.find((e) => e.id === elemento)?.style;

test.describe('panel de estilo', () => {
  test('cambiar el relleno de una clase se ve al instante, persiste al recargar y Ctrl+Z lo revierte', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Estilo' });
    await page.goto(`/d/${id}`);
    const autor = page.locator('[data-element-id="Autor"]');
    await autor.click({ position: { x: 20, y: 8 } });

    await page.getByRole('button', { name: 'Relleno: Rojo' }).click();
    await expect(autor.locator('rect[fill="#dc2626"]').first()).toBeVisible();
    await expect.poll(() => estiloDe(agent, id, 'Autor')).toEqual({ fillColor: '#dc2626' });

    await page.reload();
    await expect(page.locator('[data-element-id="Autor"] rect[fill="#dc2626"]').first()).toBeVisible();

    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.getByRole('combobox', { name: 'Familia de fuente' }).selectOption('serif');
    await expect.poll(() => estiloDe(agent, id, 'Autor')).toEqual({ fillColor: '#dc2626', fontFamily: 'serif' });

    // Ctrl+Z revierte el último cambio aunque el foco siga en el selector.
    await page.keyboard.press('Control+z');
    await expect.poll(() => estiloDe(agent, id, 'Autor')).toEqual({ fillColor: '#dc2626' });

    await page.getByRole('button', { name: 'Restablecer estilo' }).click();
    await expect.poll(() => estiloDe(agent, id, 'Autor')).toBeUndefined();
    await expect(page.locator('[data-element-id="Autor"] rect[fill="#dc2626"]')).toHaveCount(0);
  });

  test('el selector libre y la selección múltiple aplican el color a todos', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Varios' });
    await page.goto(`/d/${id}`);
    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.locator('[data-element-id="Libro"]').click({ position: { x: 20, y: 8 }, modifiers: ['Control'] });

    await page.getByLabel('Color de borde libre').fill('#123456');
    await expect.poll(() => estiloDe(agent, id, 'Autor')).toEqual({ borderColor: '#123456' });
    await expect.poll(() => estiloDe(agent, id, 'Libro')).toEqual({ borderColor: '#123456' });
  });
});
