import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('US1 · escenario 3: error UNKNOWN_REFERENCE accionable y nada cambia en la app', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Antes del error' });
  await page.goto(`/d/${id}`);
  await expect(page.getByText('Préstamo', { exact: true })).toBeVisible();
  const items = await page.locator('.diagram-list__item').count();

  const res = await agent.apply([{ op: 'add_relation', relation: { id: 'h1', kind: 'inheritance', source: 'Socio', target: 'Persona' } }]);
  expect(res.isError).toBe(true);
  const error = res.structuredContent!.errors![0]!;
  expect(error).toMatchObject({ code: 'UNKNOWN_REFERENCE', path: '/relations/3/target' });
  expect(error.hint).toContain('Persona');

  // El agente corrige en el siguiente turno añadiendo la clase que faltaba.
  const fixed = await agent.apply([
    { op: 'add_element', element: { id: 'Persona', kind: 'class', name: 'Persona', attributes: [], operations: [] } },
    { op: 'add_relation', relation: { id: 'h1', kind: 'inheritance', source: 'Socio', target: 'Persona' } },
  ]);
  expect(fixed.isError).toBeFalsy();
  await expect(page.locator('[data-element-id="Persona"]')).toBeVisible();
  await expect(page.locator('.diagram-list__item')).toHaveCount(items);
  await expect(page.getByText(/rev 2/)).toBeVisible();
});
