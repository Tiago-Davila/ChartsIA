import { expect, test } from './support/fixtures';

const grouped = {
  type: 'class',
  title: 'Integraciones',
  elements: [
    { id: 'pkg', kind: 'package', name: 'Integraciones externas' },
    { id: 'Deposito', kind: 'interface', name: 'AdapterDeposito', operations: [], parentId: 'pkg' },
    { id: 'Contable', kind: 'class', name: 'AdapterContable', attributes: [], operations: [], parentId: 'pkg' },
    { id: 'Rest', kind: 'class', name: 'AdapterRest', attributes: [], operations: [], parentId: 'pkg' },
  ],
  relations: [{ id: 'r1', kind: 'realization', source: 'Contable', target: 'Deposito' }],
};

test.describe('paquetes', () => {
  test('dentro de un paquete se puede editar, sacar del grupo y borrar', async ({ page, agent }) => {
    const id = await agent.create(grouped);
    await page.goto(`/d/${id}`);
    const element = async (elId: string) => (await agent.layout(id)).elements.find((e) => e.id === elId);

    await page.getByText('AdapterContable', { exact: true }).dblclick();
    const input = page.getByRole('textbox', { name: 'Editar texto' });
    await input.fill('AdapterContableRest');
    await input.press('Enter');
    await expect.poll(async () => (await element('Contable'))?.name).toBe('AdapterContableRest');

    await page.locator('[data-element-id="Contable"]').click({ position: { x: 20, y: 8 } });
    await page.getByRole('button', { name: 'Sacar del grupo' }).click();
    await expect.poll(async () => (await element('Contable'))?.parentId).toBeUndefined();

    await page.locator('[data-element-id="Rest"]').click({ position: { x: 20, y: 8 } });
    await page.keyboard.press('Delete');
    await expect.poll(async () => element('Rest')).toBeUndefined();
  });

  test('Desagrupar quita el paquete y deja sus clases', async ({ page, agent }) => {
    const id = await agent.create(grouped);
    await page.goto(`/d/${id}`);
    await page.getByText('Integraciones externas', { exact: true }).click();
    await page.getByRole('button', { name: 'Desagrupar' }).click();
    await expect.poll(async () => (await agent.layout(id)).elements.map((e) => e.id).sort()).toEqual(['Contable', 'Deposito', 'Rest']);
  });
});
