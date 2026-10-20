import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('al editar un tipo aparece la lista de tipos filtrada y Enter la aplica', async ({ page, agent }) => {
  const id = await agent.create({ ...library, title: 'Tipos' });
  await page.goto(`/d/${id}`);
  await page.getByText('- numero: int').dblclick();
  const input = page.getByRole('combobox', { name: 'Editar texto' });
  await input.fill('- numero: do');
  const list = page.getByRole('listbox', { name: 'Tipos sugeridos' });
  await expect(list.getByRole('option').first()).toHaveText('double');
  await input.press('Enter');
  await expect(input).toHaveValue('- numero: double');
  await input.press('Enter');
  await expect.poll(async () => (await agent.layout(id)).elements.find((e) => e.id === 'Socio')).toMatchObject({ attributes: [{ name: 'numero', type: 'double' }] });

  await page.getByText('+ prestar(libro: Libro): Prestamo').dblclick();
  await page.getByRole('combobox', { name: 'Editar texto' }).fill('+ prestar(libro: Libro): v');
  await expect(list.getByRole('option').first()).toHaveText('void');
});
