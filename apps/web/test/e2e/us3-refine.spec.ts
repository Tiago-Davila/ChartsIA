import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('US3 · escenario 5: tres refinamientos en vivo sin mover lo no afectado', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Refinar' });
  await page.goto(`/d/${id}`);
  await expect(page.getByText('Préstamo', { exact: true })).toBeVisible();
  const before = await agent.layout(id);
  const pos = (d: typeof before, elId: string) => d.elements.find((e) => e.id === elId)!.layout;

  await agent.apply([
    { op: 'add_element', element: { id: 'Editorial', kind: 'class', name: 'Editorial', attributes: [], operations: [] } },
    { op: 'add_relation', relation: { id: 'r4', kind: 'association', source: 'Libro', target: 'Editorial' } },
  ]);
  await expect(page.getByText('Editorial', { exact: true })).toBeVisible();

  await agent.apply([{ op: 'update_element', id: 'Socio', changes: { name: 'Usuario' } }]);
  await expect(page.getByText('Usuario', { exact: true })).toBeVisible();
  await expect(page.getByText('Socio', { exact: true })).toHaveCount(0);

  await agent.apply([{ op: 'remove_element', id: 'Prestamo' }]);
  await expect(page.getByText('Préstamo', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid="edge-r2"], [data-testid="edge-r3"]')).toHaveCount(0);

  const after = await agent.layout(id);
  for (const elId of ['Libro', 'Autor']) expect(pos(after, elId)).toEqual(pos(before, elId));
  expect(pos(after, 'Socio')).toMatchObject({ x: pos(before, 'Socio').x, y: pos(before, 'Socio').y });
  await expect(page.getByText(/rev 4/)).toBeVisible();
});
