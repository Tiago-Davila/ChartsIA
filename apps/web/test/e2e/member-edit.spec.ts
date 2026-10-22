import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

interface Members {
  attributes: { name: string; type?: string }[];
  operations: { name: string; returnType?: string }[];
}

test('agregar y quitar atributos y métodos desde la app, y deshacer con Ctrl+Z', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Miembros' });
  const members = async () => (await agent.layout(id)).elements.find((e) => e.id === 'Libro') as unknown as Members;
  await page.goto(`/d/${id}`);

  // Sin selección no hay botones; al seleccionar la clase aparecen.
  await expect(page.getByRole('button', { name: 'Agregar atributo' })).toHaveCount(0);
  await page.locator('[data-element-id="Libro"]').click({ position: { x: 20, y: 8 } });

  // El atributo nuevo queda en edición con un texto válido.
  await page.getByRole('button', { name: 'Agregar atributo' }).click();
  const input = page.getByRole('combobox', { name: 'Editar texto' });
  await expect(input).toHaveValue('+ atributo: String');
  await expect.poll(async () => (await members()).attributes.map((a) => a.name)).toEqual(['isbn', 'titulo', 'atributo']);
  await input.fill('- paginas: int = 0');
  await input.press('Enter');
  await expect.poll(async () => (await members()).attributes.map((a) => a.name)).toEqual(['isbn', 'titulo', 'paginas']);

  // Lo mismo con un método.
  await page.getByRole('button', { name: 'Agregar método' }).click();
  await expect(input).toHaveValue('+ metodo(): void');
  await input.fill('+ leer()');
  await input.press('Enter');
  await expect.poll(async () => (await members()).operations).toMatchObject([{ name: 'leer' }]);

  // Quitar un atributo es un solo paso y Ctrl+Z lo devuelve.
  await page.getByRole('button', { name: 'Quitar - titulo: String' }).click();
  await expect.poll(async () => (await members()).attributes.map((a) => a.name)).toEqual(['isbn', 'paginas']);
  await expect(page.getByText('- titulo: String')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await members()).attributes.map((a) => a.name)).toEqual(['isbn', 'titulo', 'paginas']);
  await expect(page.getByText('- titulo: String')).toBeVisible();
});

test('agregar un miembro se deshace en un solo Ctrl+Z', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Un paso' });
  const members = async () => (await agent.layout(id)).elements.find((e) => e.id === 'Autor') as unknown as Members;
  await page.goto(`/d/${id}`);
  await page.locator('[data-element-id="Autor"]').click({ position: { x: 20, y: 8 } });
  await page.getByRole('button', { name: 'Agregar método' }).click();
  await expect.poll(async () => (await members()).operations.length).toBe(1);
  await page.getByRole('combobox', { name: 'Editar texto' }).press('Escape');

  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await members()).operations.length).toBe(0);
});
