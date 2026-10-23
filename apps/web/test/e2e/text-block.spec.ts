import { expect, test } from './support/fixtures';

const base = { type: 'class', title: 'Bloque de texto', elements: [{ id: 'Clase', kind: 'class', name: 'Clase', attributes: [], operations: [] }], relations: [] };
const MARKDOWN = '# Notas\n\nUn **punto** y *matiz*.\n\n- uno\n- dos\n\n```ts\nconst total = 42;\n```';

test.describe('bloque de texto', () => {
  test('la herramienta Texto crea un bloque en edición que se ve formateado al salir y se guarda en el hub', async ({ page, agent }) => {
    const id = await agent.create(base);
    await page.goto(`/d/${id}`);

    await page.getByRole('button', { name: 'Texto', exact: true }).click();
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    await page.mouse.click(pane.x + 160, pane.y + pane.height - 200);

    const editor = page.getByLabel('Editar bloque de texto');
    await expect(editor).toBeFocused();
    await expect(page.getByRole('button', { name: 'Texto', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await editor.fill(MARKDOWN);
    // Salir del campo confirma el texto.
    await page.locator('.react-flow__pane').click({ position: { x: 600, y: 40 } });
    await expect(editor).toHaveCount(0);

    const bloque = page.locator('[data-element-id="Texto"]');
    await expect(bloque.locator('text[data-slot="name"]', { hasText: 'Notas' })).toHaveAttribute('font-weight', 'bold');
    await expect(bloque.locator('text[data-slot="name"]', { hasText: 'ts' })).toBeVisible();
    await expect(bloque.locator('text[data-slot="name"]', { hasText: 'const' })).toHaveAttribute('fill', '#7c3aed');
    await expect(bloque.locator('text[data-slot="name"]', { hasText: 'punto' })).toHaveAttribute('font-weight', 'bold');

    await expect.poll(async () => (await agent.layout(id)).elements.find((e) => e.id === 'Texto')).toMatchObject({ kind: 'text', name: MARKDOWN });
  });

  test('doble clic en un bloque lo abre en edición y Ctrl+Enter guarda el cambio', async ({ page, agent }) => {
    const id = await agent.create({
      ...base,
      elements: [...base.elements, { id: 'Nota', kind: 'text', name: '## Antes', layout: { x: 60, y: 60 } }],
    });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Nota"] text[data-slot="name"]').dblclick();
    const editor = page.getByLabel('Editar bloque de texto');
    await expect(editor).toHaveValue('## Antes');
    await editor.fill('## Después\n- ahora con lista');
    await editor.press('Control+Enter');
    await expect(editor).toHaveCount(0);

    await expect(page.locator('[data-element-id="Nota"] text[data-slot="name"]', { hasText: 'Después' })).toHaveAttribute('font-size', '20');
    await expect.poll(async () => (await agent.layout(id)).elements.find((e) => e.id === 'Nota')).toMatchObject({ name: '## Después\n- ahora con lista' });
  });

  test('Escape cancela la edición y el bloque conserva su texto', async ({ page, agent }) => {
    const id = await agent.create({
      ...base,
      elements: [...base.elements, { id: 'Nota', kind: 'text', name: 'Texto original', layout: { x: 60, y: 60 } }],
    });
    await page.goto(`/d/${id}`);

    await page.locator('[data-element-id="Nota"]').getByText('Texto', { exact: true }).dblclick();
    const editor = page.getByLabel('Editar bloque de texto');
    await editor.fill('descartado');
    await editor.press('Escape');
    await expect(editor).toHaveCount(0);

    // Cada palabra es un trozo de texto aparte, así que se comprueba la última.
    await expect(page.locator('[data-element-id="Nota"]').getByText('original', { exact: true })).toBeVisible();
    expect((await agent.layout(id)).elements.find((e) => e.id === 'Nota')?.name).toBe('Texto original');
  });
});
