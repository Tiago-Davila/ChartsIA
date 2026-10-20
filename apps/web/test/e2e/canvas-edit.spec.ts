import { type Page } from '@playwright/test';
import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

/** Arrastra con el mouse desde el centro de una caja hasta otro punto de la pantalla. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

const center = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

test.describe('más edición en el lienzo', () => {
  test('redimensionar una clase fija su tamaño en el hub', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Tamaño' });
    await page.goto(`/d/${id}`);
    const autor = page.locator('[data-element-id="Autor"]');
    await autor.click({ position: { x: 20, y: 8 } });
    const before = (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout;
    const corner = page.locator('.react-flow__resize-control.handle.bottom.right');
    const box = (await corner.boundingBox())!;
    await drag(page, center(box), { x: center(box).x + 120, y: center(box).y + 60 });
    await expect.poll(async () => (await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout.resized).toBe(true);
    expect((await agent.layout(id)).elements.find((e) => e.id === 'Autor')!.layout.width).toBeGreaterThan(before.width + 50);
  });

  test('barra de la flecha: tipo, invertir, lado, quiebre y textos', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Flechas' });
    await page.goto(`/d/${id}`);
    const relation = async () => (await agent.layout(id)).relations.find((r) => r.id === 'r1')!;
    await page.locator('[data-testid="edge-r1"] .react-flow__edge-interaction').dispatchEvent('click');

    await page.getByRole('combobox', { name: 'Tipo de flecha' }).selectOption('dependency');
    await expect.poll(async () => (await relation()).kind).toBe('dependency');
    await page.getByRole('button', { name: 'Invertir' }).click();
    await expect.poll(async () => (await relation()).source).toBe('Autor');
    await page.getByRole('combobox', { name: 'Salida' }).selectOption('right');
    await expect.poll(async () => (await relation()).sourceSide).toBe('right');

    const handle = page.getByRole('button', { name: 'Arrastrar para quebrar la flecha' }).nth(1);
    const box = (await handle.boundingBox())!;
    await drag(page, center(box), { x: center(box).x + 60, y: center(box).y + 40 });
    await expect.poll(async () => (await relation()).waypoints?.length).toBe(1);

    await page.getByRole('button', { name: 'Textos' }).click();
    await page.getByRole('textbox', { name: 'Etiqueta' }).fill('escribe');
    await page.getByRole('textbox', { name: 'Etiqueta' }).press('Enter');
    await expect.poll(async () => (await relation()).label).toBe('escribe');
  });

  test('conectar arrastrando, duplicar con Ctrl+D y alinear la selección', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Conectar' });
    await page.goto(`/d/${id}`);
    const relations = async () => (await agent.layout(id)).relations;

    const libro = page.locator('[data-element-id="Libro"]');
    await libro.hover();
    const from = (await libro.locator('.react-flow__handle-bottom').boundingBox())!;
    const to = (await page.locator('[data-element-id="Socio"] .react-flow__handle-top').boundingBox())!;
    await drag(page, center(from), center(to));
    await expect.poll(async () => (await relations()).some((r) => r.source === 'Libro' && r.target === 'Socio')).toBe(true);

    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.keyboard.press('Control+d');
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Autor_copia');

    await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
    await page.locator('[data-element-id="Socio"]').click({ position: { x: 20, y: 8 }, modifiers: ['Control'] });
    await page.getByText('Alinear', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Alinear a la izquierda' }).click();
    await expect
      .poll(async () => {
        const els = (await agent.layout(id)).elements;
        return els.find((e) => e.id === 'Autor')!.layout.x === els.find((e) => e.id === 'Socio')!.layout.x;
      })
      .toBe(true);
  });
});
