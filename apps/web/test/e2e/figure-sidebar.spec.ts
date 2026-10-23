import { type Page } from '@playwright/test';
import { type FakeAgent } from './support/fake-agent';
import { expect, test } from './support/fixtures';

const base = { type: 'class', title: 'Barra de figuras', elements: [{ id: 'Existente', kind: 'class', name: 'Existente', attributes: [], operations: [] }], relations: [] };

// Arrastra una figura de la barra derecha al punto del lienzo y devuelve la posición esperada en el diagrama.
async function arrastrar(page: Page, figura: string, destino: { x: number; y: number }) {
  const pane = page.locator('.react-flow__pane');
  await page.locator(`[data-figure="${figura}"]`).dragTo(pane, { targetPosition: destino });
  const viewport = await page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
  return { x: (destino.x - viewport.e) / viewport.a, y: (destino.y - viewport.f) / viewport.d };
}

const elemento = async (agent: FakeAgent, diagramId: string, id: string) => (await agent.layout(diagramId)).elements.find((e) => e.id === id);

test.describe('barra de figuras', () => {
  test('arrastrar una clase y una figura general las crea en el hub en la posición soltada', async ({ page, agent }) => {
    const id = await agent.create(base);
    await page.goto(`/d/${id}`);
    await expect(page.getByRole('complementary', { name: 'Figuras' })).toBeVisible();

    const clase = await arrastrar(page, 'class', { x: 300, y: 450 });
    await expect.poll(() => elemento(agent, id, 'Clase')).toMatchObject({ kind: 'class', name: 'Clase', layout: { pinned: true } });
    const creada = (await elemento(agent, id, 'Clase'))!;
    expect(Math.abs(creada.layout.x - clase.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(creada.layout.y - clase.y)).toBeLessThanOrEqual(2);
    await expect(page.locator('[data-element-id="Clase"]')).toBeVisible();

    const circulo = await arrastrar(page, 'figure-circle', { x: 600, y: 450 });
    await expect.poll(() => elemento(agent, id, 'Circulo')).toMatchObject({ kind: 'figure', name: 'Círculo', layout: { pinned: true } });
    const figura = (await elemento(agent, id, 'Circulo'))!;
    expect(Math.abs(figura.layout.x - circulo.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(figura.layout.y - circulo.y)).toBeLessThanOrEqual(2);
    await expect(page.locator('[data-element-id="Circulo"]')).toBeVisible();

    // Una segunda clase recibe un id libre y el diagrama sigue guardado tras recargar.
    await arrastrar(page, 'class', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, id, 'Clase2')).toMatchObject({ kind: 'class', name: 'Clase2' });
    await page.reload();
    await expect(page.locator('[data-element-id="Clase2"]')).toBeVisible();
  });

  test('soltar una flecha en el lienzo la crea en el hub con su forma y en la posición soltada', async ({ page, agent }) => {
    const id = await agent.create(base);
    await page.goto(`/d/${id}`);

    const doble = await arrastrar(page, 'figure-double-arrow', { x: 400, y: 300 });
    await expect.poll(() => elemento(agent, id, 'FlechaDoble')).toMatchObject({ kind: 'figure', shape: 'double-arrow', layout: { pinned: true } });
    const creada = (await elemento(agent, id, 'FlechaDoble'))!;
    expect(Math.abs(creada.layout.x - doble.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(creada.layout.y - doble.y)).toBeLessThanOrEqual(2);
    await expect(page.locator('[data-element-id="FlechaDoble"]')).toBeVisible();
  });

  test('doble clic en una figura la agrega centrada en la vista, sin tapar otra, y Ctrl+Z la deshace', async ({ page, agent }) => {
    const id = await agent.create({ type: 'class', title: 'Doble clic', elements: [], relations: [] });
    await page.goto(`/d/${id}`);

    await page.locator('[data-figure="class"]').dblclick();
    await expect.poll(() => elemento(agent, id, 'Clase')).toMatchObject({ kind: 'class', name: 'Clase', layout: { pinned: true } });
    // El encuadre inicial ya se aplicó con la primera figura: el centro se mide después de crearla.
    // El transform del viewport es relativo al lienzo, así que el centro va en coordenadas del lienzo.
    const lienzo = (await page.locator('.app-shell__canvas').boundingBox())!;
    const viewport = await page.locator('.react-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform));
    const centro = { x: (lienzo.width / 2 - viewport.e) / viewport.a, y: (lienzo.height / 2 - viewport.f) / viewport.d };
    const primera = (await elemento(agent, id, 'Clase'))!;
    expect(Math.abs(primera.layout.x + primera.layout.width / 2 - centro.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(primera.layout.y + primera.layout.height / 2 - centro.y)).toBeLessThanOrEqual(2);

    // La segunda figura cae sobre el centro ocupado: se corre y no tapa a la primera.
    await page.locator('[data-figure="class"]').dblclick();
    await expect.poll(() => elemento(agent, id, 'Clase2')).toMatchObject({ kind: 'class', name: 'Clase2', layout: { pinned: true } });
    const segunda = (await elemento(agent, id, 'Clase2'))!;
    const separadas = segunda.layout.x >= primera.layout.x + primera.layout.width || segunda.layout.x + segunda.layout.width <= primera.layout.x
      || segunda.layout.y >= primera.layout.y + primera.layout.height || segunda.layout.y + segunda.layout.height <= primera.layout.y;
    expect(separadas).toBe(true);

    // Cada doble clic es una sola operación: Ctrl+Z quita solo la última figura.
    await page.keyboard.press('Control+z');
    await expect.poll(() => elemento(agent, id, 'Clase2')).toBeUndefined();
    expect(await elemento(agent, id, 'Clase')).toBeDefined();
    await expect(page.locator('[data-element-id="Clase"]')).toBeVisible();
  });

  test('los botones de la barra entran en su ancho sin desplazamiento horizontal', async ({ page, agent }) => {
    const er = await agent.create({ type: 'er', title: 'ER', elements: [], relations: [] });
    await page.goto(`/d/${er}`);
    const barra = page.locator('.figure-sidebar__list');
    const botones = page.locator('.figure-sidebar__item');
    await expect(botones.last()).toBeVisible();

    const ancho = await barra.evaluate((el) => ({ scroll: el.scrollWidth, cliente: el.clientWidth }));
    expect(ancho.scroll).toBeLessThanOrEqual(ancho.cliente);
    const caja = (await barra.boundingBox())!;
    for (const boton of await botones.all()) {
      const { x, width } = (await boton.boundingBox())!;
      expect(x).toBeGreaterThanOrEqual(caja.x);
      expect(x + width).toBeLessThanOrEqual(caja.x + caja.width);
      // El texto de cada botón también cabe: no se corta dentro del botón.
      expect(await boton.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });

  test('cualquier tipo de diagrama ofrece todas las figuras y el hub acepta las que se sueltan', async ({ page, agent }) => {
    const er = await agent.create({ type: 'er', title: 'ER', elements: [], relations: [] });
    await page.goto(`/d/${er}`);
    await expect(page.locator('[data-figure="class"]')).toHaveCount(1);
    await arrastrar(page, 'table', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, er, 'Tabla')).toMatchObject({ kind: 'table' });
    await arrastrar(page, 'class', { x: 500, y: 250 });
    await expect.poll(() => elemento(agent, er, 'Clase')).toMatchObject({ kind: 'class' });

    const nosql = await agent.create({ type: 'nosql', title: 'Docs', elements: [], relations: [] });
    await page.goto(`/d/${nosql}`);
    await arrastrar(page, 'collection', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, nosql, 'Coleccion')).toMatchObject({ kind: 'collection' });

    const c4 = await agent.create({ type: 'c4-component', title: 'Componentes', elements: [], relations: [] });
    await page.goto(`/d/${c4}`);
    await arrastrar(page, 'component', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, c4, 'Componente')).toMatchObject({ kind: 'component', parentId: 'Limite' });
  });

  test('las secciones de la barra empiezan desplegadas y se pliegan y despliegan con su título', async ({ page, agent }) => {
    const id = await agent.create(base);
    await page.goto(`/d/${id}`);
    const seccionC4 = page.locator('details.figure-sidebar__section', { has: page.getByText('C4', { exact: true }) });
    await expect(page.locator('[data-figure="person"]')).toBeVisible();

    await seccionC4.locator('summary').click();
    await expect(seccionC4).toHaveJSProperty('open', false);
    await expect(page.locator('[data-figure="person"]')).toBeHidden();
    // Plegar una sección no oculta las demás.
    await expect(page.locator('[data-figure="class"]')).toBeVisible();
    await expect(page.locator('[data-figure="figure-circle"]')).toBeVisible();

    await seccionC4.locator('summary').click();
    await expect(seccionC4).toHaveJSProperty('open', true);
    await expect(page.locator('[data-figure="person"]')).toBeVisible();
  });

  test('en un diagrama ER la sección ER va primera en la barra', async ({ page, agent }) => {
    const er = await agent.create({ type: 'er', title: 'ER', elements: [], relations: [] });
    await page.goto(`/d/${er}`);
    await expect(page.locator('details.figure-sidebar__section').first().locator('summary')).toHaveText('ER');
  });
});
