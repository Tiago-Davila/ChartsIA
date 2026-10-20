import { expect, test } from './support/fixtures';

const EVIL = '<img src=x onerror=alert(1)>';

test('escenario 10: un nombre con HTML se ve literal en la app y en el SVG; ningún diálogo', async ({ page, agent }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const id = await agent.create({
    type: 'class',
    title: EVIL,
    elements: [{ id: 'X', kind: 'class', name: EVIL, attributes: [{ name: EVIL, visibility: '+' }], operations: [] }],
    relations: [],
  });
  await page.goto(`/d/${id}`);
  await expect(page.getByTestId('shape-X').getByText(EVIL, { exact: true })).toBeVisible();
  await expect(page.locator('.diagram-list__name', { hasText: EVIL })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  const svg = await (await page.request.get(`/api/diagrams/${id}/export?format=svg`)).text();
  expect(svg).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(svg).not.toContain('<img');

  // Abrir el SVG exportado en el navegador tampoco ejecuta nada.
  await page.setContent(svg);
  await page.waitForTimeout(300);
  expect(dialogs).toEqual([]);
});
