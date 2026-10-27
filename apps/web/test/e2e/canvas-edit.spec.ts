import { type Locator, type Page } from '@playwright/test';
import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

/** Arrastra con el mouse desde el centro de una caja hasta otro punto de la pantalla. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

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

/** Hace clic en el primer punto del nodo que no tapan aristas ni handles, recorriéndolo desde arriba. */
async function clicLibre(page: Page, nodo: Locator, modifiers: 'Control'[] = []) {
  await esperarQuieto(nodo);
  const id = await nodo.getAttribute('data-element-id');
  const punto = await page.evaluate((id) => {
    const caja = document.querySelector(`[data-element-id="${id}"]`)!.getBoundingClientRect();
    for (let y = 6; y < caja.height; y += 8) {
      for (let x = 6; x < caja.width; x += 8) {
        const encima = document.elementFromPoint(caja.left + x, caja.top + y);
        if (!encima?.closest('.react-flow__handle') && encima?.closest('[data-element-id]')?.getAttribute('data-element-id') === id) return { x, y };
      }
    }
    return null;
  }, id);
  if (!punto) throw new Error(`El nodo ${id} no tiene ningún punto visible libre de aristas`);
  await nodo.click({ position: punto, modifiers });
}

const center = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

test.describe('más edición en el lienzo', () => {
  test('seleccionar con un rectángulo permite alinear y borrar varias clases', async ({ page, agent }) => {
    const id = await agent.create({
      type: 'class',
      title: 'Selección múltiple',
      elements: [
        { id: 'Primera', kind: 'class', name: 'Primera', attributes: [], operations: [], layout: { x: 100, y: 100 } },
        { id: 'Segunda', kind: 'class', name: 'Segunda', attributes: [], operations: [], layout: { x: 500, y: 350 } },
        { id: 'Tercera', kind: 'class', name: 'Tercera', attributes: [], operations: [], layout: { x: 100, y: 900 } },
      ],
      relations: [],
    });
    await page.goto(`/d/${id}`);

    const primero = (await page.locator('[data-element-id="Primera"]').boundingBox())!;
    const segundo = (await page.locator('[data-element-id="Segunda"]').boundingBox())!;
    await drag(
      page,
      { x: primero.x - 20, y: primero.y + 20 },
      { x: segundo.x + segundo.width + 20, y: segundo.y + 20 },
    );

    await expect.poll(() => page.locator('.react-flow__node.selected').count()).toBe(2);
    await page.getByText('Alinear', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'Alinear arriba' }).click();
    await expect
      .poll(async () => {
        const elements = (await agent.layout(id)).elements;
        return elements.find((element) => element.id === 'Primera')!.layout.y === elements.find((element) => element.id === 'Segunda')!.layout.y;
      })
      .toBe(true);

    await page.keyboard.press('Delete');
    await expect.poll(async () => (await agent.layout(id)).elements.map((element) => element.id)).toEqual(['Tercera']);
  });

  test('la rueda y espacio más arrastre desplazan el lienzo', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Desplazar' });
    await page.goto(`/d/${id}`);
    await expect(page.locator('.react-flow__node')).toHaveCount(4);

    const canvas = (await page.locator('.react-flow').boundingBox())!;
    const from = { x: canvas.x + canvas.width - 30, y: canvas.y + 30 };
    const to = { x: from.x - 70, y: from.y + 60 };
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('react-flow__pane'), from)).toBe(true);
    const viewport = page.locator('.react-flow__viewport');
    await expect.poll(() => viewport.evaluate((element) => getComputedStyle(element).transform)).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
    const beforeWheel = await viewport.getAttribute('style');
    await page.mouse.move(from.x, from.y);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => viewport.getAttribute('style')).not.toBe(beforeWheel);

    const beforeDrag = await viewport.getAttribute('style');
    await page.keyboard.down('Space');
    await drag(page, from, to);
    await page.keyboard.up('Space');
    await expect.poll(() => viewport.getAttribute('style')).not.toBe(beforeDrag);
  });

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
    const socio = page.locator('[data-element-id="Socio"]');
    await esperarQuieto(libro);
    await esperarQuieto(socio);
    await libro.hover();
    const from = (await libro.locator('.react-flow__handle-bottom').boundingBox())!;
    const to = (await socio.locator('.react-flow__handle-top').boundingBox())!;
    await expect.poll(() => page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.react-flow__handle'), center(from))).toBe(true);
    await drag(page, center(from), center(to));
    await expect.poll(async () => (await relations()).some((r) => r.source === 'Libro' && r.target === 'Socio')).toBe(true);

    const autor = page.locator('[data-element-id="Autor"]');
    await clicLibre(page, autor);
    await page.keyboard.press('Control+d');
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id)).toContain('Autor_copia');

    // La copia agranda el diagrama y puede dejar a Autor fuera de la vista.
    await page.getByRole('button', { name: 'Ajustar', exact: true }).click();
    await clicLibre(page, autor);
    await clicLibre(page, socio, ['Control']);
    await expect.poll(() => page.locator('.react-flow__node.selected').count()).toBe(2);
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
