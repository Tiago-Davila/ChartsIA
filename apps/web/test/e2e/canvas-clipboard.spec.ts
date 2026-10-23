import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('copiar, cortar y pegar', () => {
  test('Ctrl+C y Ctrl+V pegan la selección con ids nuevos, corridos 30 px, y conservan la flecha entre ellos', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Copiar pegar' });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Libro"]').click({ position: { x: 20, y: 8 } });
    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 }, modifiers: ['Control'] });
    // Antes de pegar: el hub recoloca lo que no está fijado al llegar elementos nuevos.
    const before = (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout;
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');

    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Autor_copia');
    const layout = await agent.layout(id);
    const copy = layout.elements.find((e) => e.id === 'Autor_copia')!.layout;
    expect(copy.x).toBe(Math.round(before.x + 30));
    expect(copy.y).toBe(Math.round(before.y + 30));
    expect(layout.relations.find((r) => r.id === 'r1_copia')).toMatchObject({ source: 'Libro_copia', target: 'Autor_copia' });
  });

  test('pegar en otro diagrama crea los elementos sin desplazarlos', async ({ page, agent }) => {
    const origen = await agent.create({ ...library, title: 'Origen' });
    const destino = await agent.create({ type: 'class', title: 'Destino', elements: [], relations: [] });
    await page.goto(`/d/${origen}`);

    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.keyboard.press('Control+c');
    await page.getByText('Destino').first().click();
    await expect(page.getByRole('heading', { name: 'Destino' })).toBeVisible();
    await page.keyboard.press('Control+v');

    await expect.poll(async () => (await agent.layout(destino)).elements.map((e) => e.id)).toContain('Autor_copia');
    const original = (await agent.layout(origen)).elements.find((e) => e.id === 'Autor')!.layout;
    const pegado = (await agent.layout(destino)).elements.find((e) => e.id === 'Autor_copia')!.layout;
    expect(pegado.x).toBe(Math.round(original.x));
    expect(pegado.y).toBe(Math.round(original.y));
  });

  test('cortar borra la selección en un solo paso de Ctrl+Z y Ctrl+V la vuelve a pegar', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Cortar pegar' });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Libro"]').click({ position: { x: 20, y: 8 } });
    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 }, modifiers: ['Control'] });
    await page.keyboard.press('Control+x');
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id).sort()).toEqual(['Prestamo', 'Socio']);

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id).sort()).toEqual(['Autor', 'Libro', 'Prestamo', 'Socio']);

    await page.keyboard.press('Control+v');
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Libro_copia');
  });

  test('el menú ofrece Copiar, Cortar y Pegar solo cuando hay algo copiado', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Menú copiar' });
    await page.goto(`/d/${id}`);
    const menu = page.getByRole('menu');

    await page.locator('[data-element-id="Autor"]').click({ button: 'right', position: { x: 20, y: 8 } });
    await expect(menu.getByRole('menuitem', { name: 'Copiar', exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Cortar' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Pegar', exact: true })).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Copiar', exact: true }).click();

    await page.locator('[data-element-id="Autor"]').click({ button: 'right', position: { x: 20, y: 8 } });
    await menu.getByRole('menuitem', { name: 'Pegar', exact: true }).click();
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Autor_copia');
  });

  test('clic derecho en el lienzo vacío ofrece solo Pegar', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Pegar en el lienzo' });
    await page.goto(`/d/${id}`);
    const menu = page.getByRole('menu');
    const pane = page.locator('.react-flow__pane');

    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.keyboard.press('Control+c');
    await pane.click({ button: 'right', position: { x: 10, y: 10 } });
    await expect(menu.getByRole('menuitem')).toHaveText(['Pegar']);
    await menu.getByRole('menuitem', { name: 'Pegar', exact: true }).click();
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Autor_copia');
  });
});
