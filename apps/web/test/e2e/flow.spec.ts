import { type Locator, type Page } from '@playwright/test';
import { library } from './support/fake-agent';
import { idDesdeUrl } from './support/rutas';
import { expect, test } from './support/fixtures';

/** Espera a que la caja de un elemento deje de moverse, con el layout ya asentado. */
async function esperarQuieto(locator: Locator) {
  let anterior = '';
  await expect
    .poll(async () => {
      const actual = JSON.stringify(await locator.boundingBox());
      const quieto = actual === anterior;
      anterior = actual;
      return quieto;
    })
    .toBe(true);
}

const centro = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

// Arrastra una variante de la barra al punto del lienzo.
async function soltar(page: Page, figura: string, destino: { x: number; y: number }) {
  await page.locator(`[data-figure="${figura}"]`).dragTo(page.locator('.react-flow__pane'), { targetPosition: destino });
}

test('crea un flujo desde Nuevo, agrega variantes desde la barra, las conecta arrastrando y edita la conexión', async ({ page, agent }) => {
  const previous = await agent.create({ ...library, title: 'Inicio' });
  await page.goto(`/d/${previous}`);
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Diagrama en blanco' }).click();
  const form = page.getByRole('form', { name: 'Nuevo diagrama' });
  await form.getByLabel('Tipo').selectOption({ label: 'Flujo de sistema' });
  await form.getByLabel('Título').fill('Pedido');
  await form.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByRole('heading', { name: /Pedido/ })).toBeVisible();
  const id = idDesdeUrl(page.url())!;

  // La sección del flujo va primera y cada variante se agrega arrastrándola.
  await expect(page.locator('.figure-sidebar__section-title').first()).toHaveText('Flujo');
  await soltar(page, 'flow-trigger', { x: 250, y: 300 });
  await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Disparador');
  await soltar(page, 'flow-database', { x: 700, y: 300 });
  await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('BaseDeDatos');
  const elements = (await agent.layout(id)).elements;
  expect(elements.find((e) => e.id === 'Disparador')).toMatchObject({ kind: 'flow-node', name: 'Disparador' });

  // Se conecta arrastrando de la salida (derecha) a la entrada (izquierda).
  const origen = page.locator('[data-element-id="Disparador"]');
  const destino = page.locator('[data-element-id="BaseDeDatos"]');
  await esperarQuieto(origen);
  await esperarQuieto(destino);
  await origen.hover();
  const salida = centro((await origen.locator('.react-flow__handle-right').boundingBox())!);
  const entrada = centro((await destino.locator('.react-flow__handle-left').boundingBox())!);
  await page.mouse.move(salida.x, salida.y);
  await page.mouse.down();
  await page.mouse.move(entrada.x, entrada.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await agent.layout(id)).relations).toMatchObject([{ kind: 'flow-edge', source: 'Disparador', target: 'BaseDeDatos' }]);
  await expect(page.locator('[data-testid="edge-r1"]')).toBeVisible();

  // La barra de la conexión cambia su tipo y la app dibuja el trazo punteado de import.
  await expect(async () => {
    await page.locator('[data-testid="edge-r1"] .react-flow__edge-interaction').dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Tipo de conexión' }).selectOption('import');
    expect(((await agent.layout(id)).relations[0] as { flowType?: string }).flowType).toBe('import');
  }).toPass();
  await expect(page.locator('[data-testid="edge-r1"] path[stroke-dasharray="2 4"]').first()).toBeAttached();

  // El panel del nodo seleccionado guarda el subtítulo y el diagrama sigue igual al recargar.
  await origen.click({ position: { x: 100, y: 28 } });
  await page.getByLabel('Subtítulo').fill('POST /orders');
  await page.getByLabel('Subtítulo').press('Enter');
  await expect(origen).toContainText('POST /orders');
  await page.reload();
  await expect(page.locator('[data-element-id="Disparador"]')).toContainText('POST /orders');
  await expect(page.locator('[data-testid="edge-r1"]')).toBeVisible();
});
