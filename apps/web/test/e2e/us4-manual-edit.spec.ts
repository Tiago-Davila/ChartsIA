import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('US4 · escenarios 6–7: edición manual', () => {
  test('nodo movido a mano conserva su posición tras un añadido del agente', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Mover' });
    await page.goto(`/d/${id}`);
    const autor = page.locator('[data-element-id="Autor"]');
    await expect(autor).toBeVisible();
    const before = (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout;
    const box = (await autor.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + 90, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout.pinned).toBe(true);
    const moved = (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout;
    expect(moved.x).not.toBe(before.x);

    await agent.apply([{ op: 'add_element', element: { id: 'Nuevo', kind: 'class', name: 'Nuevo', attributes: [], operations: [] } }]);
    await expect(page.getByText('Nuevo', { exact: true })).toBeVisible();
    expect((await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout).toEqual(moved);
  });

  test('editar un nombre en línea y borrar con Supr; texto inválido muestra un aviso', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Editar' });
    await page.goto(`/d/${id}`);
    await page.getByText('Autor', { exact: true }).dblclick();
    const input = page.getByRole('textbox', { name: 'Editar texto' });
    await input.fill('Escritor');
    await input.press('Enter');
    await expect(page.getByText('Escritor', { exact: true })).toBeVisible();
    await expect.poll(async () => (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.name).toBe('Escritor');

    await page.getByText('+ prestar(libro: Libro): Prestamo').dblclick();
    await page.getByRole('textbox', { name: 'Editar texto' }).fill('esto no es una operación');
    await page.getByRole('textbox', { name: 'Editar texto' }).press('Enter');
    await expect(page.getByRole('alert')).toContainText('no es un valor válido');

    await page.locator('[data-element-id="Prestamo"]').click({ position: { x: 20, y: 8 } });
    await page.keyboard.press('Delete');
    await expect(page.getByText('Préstamo', { exact: true })).toHaveCount(0);
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).not.toContain('Prestamo');
  });

  test('el estilo boceto persiste tras recargar', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Estilo' });
    await page.goto(`/d/${id}`);
    await page.getByRole('button', { name: 'Boceto' }).click();
    await expect(page.getByRole('button', { name: 'Boceto' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="shape-Libro"]')).toHaveAttribute('font-family', /Excalifont/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Boceto' })).toHaveAttribute('aria-pressed', 'true');
    expect((await agent.layout(id)).style).toBe('sketch');
  });
});
