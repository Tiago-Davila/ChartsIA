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

  test('cada tipo de diagrama ofrece sus figuras y el hub acepta las que se sueltan', async ({ page, agent }) => {
    const er = await agent.create({ type: 'er', title: 'ER', elements: [], relations: [] });
    await page.goto(`/d/${er}`);
    await expect(page.locator('[data-figure="class"]')).toHaveCount(0);
    await arrastrar(page, 'table', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, er, 'Tabla')).toMatchObject({ kind: 'table' });

    const nosql = await agent.create({ type: 'nosql', title: 'Docs', elements: [], relations: [] });
    await page.goto(`/d/${nosql}`);
    await arrastrar(page, 'collection', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, nosql, 'Coleccion')).toMatchObject({ kind: 'collection' });

    const c4 = await agent.create({ type: 'c4-component', title: 'Componentes', elements: [], relations: [] });
    await page.goto(`/d/${c4}`);
    await arrastrar(page, 'component', { x: 300, y: 250 });
    await expect.poll(() => elemento(agent, c4, 'Componente')).toMatchObject({ kind: 'component', parentId: 'Limite' });
  });
});
