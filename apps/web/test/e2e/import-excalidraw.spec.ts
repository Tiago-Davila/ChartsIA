import { idDesdeUrl } from './support/rutas';
import { expect, test } from './support/fixtures';

const boceto = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [
    { id: 'Pedido', type: 'rectangle', x: 40, y: 40, width: 160, height: 80, strokeColor: '#1971c2', backgroundColor: '#a5d8ff', fillStyle: 'solid', boundElements: [{ type: 'text', id: 't1' }] },
    { id: 't1', type: 'text', x: 60, y: 70, width: 100, height: 25, text: 'Pedido', fontSize: 20, containerId: 'Pedido' },
    { id: 'Cliente', type: 'ellipse', x: 400, y: 40, width: 160, height: 80, boundElements: [{ type: 'text', id: 't2' }] },
    { id: 't2', type: 'text', x: 420, y: 70, width: 100, height: 25, text: 'Cliente', fontSize: 20, containerId: 'Cliente' },
    { id: 'flecha', type: 'arrow', x: 200, y: 80, width: 200, height: 0, points: [[0, 0], [200, 0]], startBinding: { elementId: 'Pedido' }, endBinding: { elementId: 'Cliente' }, startArrowhead: null, endArrowhead: 'arrow' },
    { id: 'web', type: 'embeddable', x: 0, y: 300, width: 100, height: 100 },
  ],
});

test('importa Excalidraw pegando el JSON, persiste figuras y conector y avisa de lo omitido', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar Excalidraw' }).click();
  await page.getByLabel('JSON de Excalidraw').fill(boceto);
  await page.getByLabel('Título (opcional)').fill('Boceto importado');
  await page.getByRole('button', { name: 'Importar' }).click();

  await expect(page.getByRole('heading', { name: /Boceto importado/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /embeddable/ })).toBeVisible();
  await page.getByRole('button', { name: 'Listo' }).click();
  const id = idDesdeUrl(page.url());
  expect(id).toBeTruthy();
  const stored = await (await page.request.get(`/api/diagrams/${id}`)).json();
  expect(stored).toMatchObject({
    title: 'Boceto importado',
    elements: [{ id: 'Pedido', kind: 'figure', name: 'Pedido', layout: { x: 40, y: 40 } }, { id: 'Cliente', kind: 'figure', shape: 'oval' }],
    relations: [{ kind: 'connector', source: 'Pedido', target: 'Cliente' }],
  });

  await page.reload();
  await expect(page.getByText('Pedido', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente', { exact: true })).toBeVisible();
});

test('importa Excalidraw eligiendo un archivo .excalidraw', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar Excalidraw' }).click();
  await page.getByLabel('Archivo .excalidraw').setInputFiles({ name: 'boceto.excalidraw', mimeType: 'application/octet-stream', buffer: Buffer.from(boceto) });
  await expect(page.getByLabel('JSON de Excalidraw')).toHaveValue(boceto);
  await page.getByLabel('Título (opcional)').fill('Desde archivo');
  await page.getByRole('button', { name: 'Importar' }).click();

  await expect(page.getByRole('heading', { name: /Desde archivo/ })).toBeVisible();
  await expect(page.getByText('Pedido', { exact: true })).toBeVisible();
});

test('al rechazar un JSON inválido conserva el texto y muestra el error accionable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar Excalidraw' }).click();
  const source = '{"type":"excalidrawlib","library":[]}';
  await page.getByLabel('JSON de Excalidraw').fill(source);
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByLabel('JSON de Excalidraw')).toHaveValue(source);
  await expect(page.getByRole('form', { name: 'Importar Excalidraw' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('excalidraw/clipboard');
});

test('pegar con Ctrl+V elementos copiados de Excalidraw los agrega al diagrama abierto', async ({ page, agent }) => {
  const id = await agent.create({ type: 'class', title: 'Pegar Excalidraw', elements: [], relations: [] });
  await page.goto(`/d/${id}`);
  await expect(page.getByRole('heading', { name: 'Pegar Excalidraw' })).toBeVisible();
  const clipboard = JSON.stringify({ type: 'excalidraw/clipboard', elements: JSON.parse(boceto).elements });

  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, clipboard);

  await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.name).sort()).toEqual(['Cliente', 'Pedido']);
  const layout = await agent.layout(id);
  expect(layout.relations).toHaveLength(1);
  expect(layout.relations[0]).toMatchObject({ kind: 'connector' });
});
