import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('crea un diagrama NoSQL, muestra subdocumentos y conserva la edición al recargar', async ({ page, agent }) => {
  const previous = await agent.create({ ...library, title: 'Inicio' });
  await page.goto(`/d/${previous}`);
  await page.getByRole('button', { name: 'Nuevo diagrama' }).click();
  const form = page.getByRole('form', { name: 'Nuevo diagrama' });
  await form.getByLabel('Tipo').selectOption('nosql');
  await form.getByLabel('Título').fill('Pedidos documentales');
  await form.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByRole('heading', { name: /Pedidos documentales/ })).toBeVisible();
  const id = page.url().split('/').at(-1)!;

  const created = await agent.apply([
    {
      op: 'add_element',
      element: {
        id: 'Pedidos',
        kind: 'collection',
        name: 'pedidos',
        fields: [
          { path: ['_id'], type: 'objectId' },
          { path: ['clienteId'], type: 'objectId' },
          { path: ['total'], type: 'number' },
          { path: ['cliente'], type: 'object' },
          { path: ['cliente', 'nombre'], type: 'string' },
          { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
          { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
          { path: ['cliente', 'direcciones', 'ciudad'], type: 'string' },
        ],
      },
    },
    {
      op: 'add_element',
      element: {
        id: 'Clientes',
        kind: 'collection',
        name: 'clientes',
        fields: [
          { path: ['nombre'], type: 'string' },
        ],
      },
    },
    { op: 'add_relation', relation: { id: 'r1', kind: 'nosql-rel', source: 'Pedidos', target: 'Clientes', label: 'clienteId' } },
  ], id);
  expect(created.isError).toBeFalsy();

  const pedidos = page.locator('[data-element-id="Pedidos"]');
  await expect(pedidos).toContainText('total: number');
  await expect(pedidos).toContainText('cliente: object');
  await expect(pedidos).toContainText('direcciones: array<object>');
  await expect(pedidos).toContainText('calle: string');
  await expect(pedidos).toContainText('ciudad: string');
  await expect(page.locator('[data-testid="edge-r1"]')).toBeVisible();

  const before = (await agent.layout(id)).elements.find((element) => element.id === 'Pedidos')!.layout;
  const box = (await pedidos.boundingBox())!;
  await page.mouse.move(box.x + 24, box.y + 18);
  await page.mouse.down();
  await page.mouse.move(box.x + 104, box.y + 78, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await agent.layout(id)).elements.find((element) => element.id === 'Pedidos')!.layout.x).not.toBe(before.x);

  await page.reload();
  await expect(page.locator('[data-element-id="Pedidos"]')).toContainText('clienteId: ObjectId');
  await expect(page.locator('[data-element-id="Pedidos"]')).toContainText('calle: string');
  await expect(page.locator('[data-testid="edge-r1"]')).toBeVisible();
});
