import { type Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/** Arrastra con el mouse desde un punto hasta otro de la pantalla. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

const center = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const twoClasses = {
  type: 'class',
  title: 'Bloqueo',
  elements: [
    { id: 'Primera', kind: 'class', name: 'Primera', attributes: [], operations: [], layout: { x: 100, y: 100 } },
    { id: 'Segunda', kind: 'class', name: 'Segunda', attributes: [], operations: [], layout: { x: 500, y: 350 } },
  ],
  relations: [],
};

test.describe('bloquear elementos', () => {
  test('Bloquear muestra el candado, impide arrastrar y Desbloquear lo libera', async ({ page, agent }) => {
    const id = await agent.create({ ...twoClasses, title: 'Bloquear uno' });
    await page.goto(`/d/${id}`);
    const primera = page.locator('[data-element-id="Primera"]');
    const candado = primera.getByRole('img', { name: 'Bloqueado' });

    await primera.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Bloquear' }).click();
    await expect(candado).toBeVisible();

    // Un arrastre sobre el elemento bloqueado no cambia su caja en pantalla.
    const antes = (await primera.boundingBox())!;
    await drag(page, center(antes), { x: center(antes).x + 150, y: center(antes).y + 90 });
    expect(await primera.boundingBox()).toEqual(antes);

    await primera.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Desbloquear' }).click();
    await expect(candado).toHaveCount(0);

    // Ya desbloqueado, el mismo arrastre sí mueve el elemento y el hub lo registra.
    await drag(page, center(antes), { x: center(antes).x + 150, y: center(antes).y + 90 });
    await expect.poll(async () => (await primera.boundingBox())!.x).not.toBeCloseTo(antes.x, 0);
    const movida = (await agent.layout(id)).elements.find((e) => e.id === 'Primera')!.layout;
    expect(movida.x).not.toBeCloseTo(100, 0);
  });

  test('con varios seleccionados, Bloquear es un solo lote que Ctrl+Z deshace', async ({ page, agent }) => {
    const id = await agent.create({ ...twoClasses, title: 'Bloquear lote' });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Primera"]').click();
    await page.locator('[data-element-id="Segunda"]').click({ modifiers: ['Control'] });
    await page.locator('[data-element-id="Primera"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Bloquear' }).click();
    await expect(page.getByRole('img', { name: 'Bloqueado' })).toHaveCount(2);

    await page.keyboard.press('Control+z');
    await expect(page.getByRole('img', { name: 'Bloqueado' })).toHaveCount(0);
  });

  test('Borrar ignora los bloqueados, y el agente puede seguir editándolos', async ({ page, agent }) => {
    const id = await agent.create({ ...twoClasses, title: 'Bloquear borrar' });
    await agent.apply([{ op: 'update_element', id: 'Primera', changes: { locked: true } }], id);
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Primera"]').click();
    await page.locator('[data-element-id="Segunda"]').click({ modifiers: ['Control'] });
    await page.locator('[data-element-id="Primera"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Borrar' }).click();

    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id).sort()).toEqual(['Primera']);

    // El agente sí puede cambiar un bloqueado por MCP: el bloqueo solo limita a la app.
    await agent.apply([{ op: 'update_element', id: 'Primera', changes: { name: 'Primera MCP' } }], id);
    await expect(page.locator('[data-element-id="Primera"]').getByText('Primera MCP')).toBeVisible();
  });
});
