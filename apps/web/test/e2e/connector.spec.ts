import { expect, test } from './support/fixtures';

const diagram = {
  type: 'er',
  title: 'Conectores',
  elements: [
    { id: 'cliente', kind: 'entity', name: 'Cliente' },
    { id: 'nube', kind: 'figure', name: 'Nube', shape: 'cloud' },
  ],
  relations: [{ id: 'k', kind: 'connector', source: 'cliente', target: 'nube', label: 'une' }],
};

test.describe('conectores libres', () => {
  test('se dibuja el conector y la barra cambia sus puntas y su trazo', async ({ page, agent }) => {
    const id = await agent.create(diagram);
    await page.goto(`/d/${id}`);
    const relation = async () => (await agent.layout(id)).relations.find((r) => r.id === 'k')!;

    await expect(page.locator('[data-testid="edge-k"]')).toBeVisible();
    // Se reintenta la selección y el cambio por si la app aún está sincronizando con el hub.
    await expect(async () => {
      await page.locator('[data-testid="edge-k"] .react-flow__edge-interaction').dispatchEvent('click');
      await page.getByRole('combobox', { name: 'Puntas' }).selectOption('both');
      expect((await relation()).arrowheads).toBe('both');
    }).toPass();

    await page.getByRole('checkbox', { name: 'Discontinua' }).click();
    await expect.poll(async () => (await relation()).dashed).toBe(true);
    await expect(page.locator('[data-testid="edge-k"] path[stroke-dasharray]').first()).toBeAttached();
  });
});
