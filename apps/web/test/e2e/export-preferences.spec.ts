import { readFile } from 'node:fs/promises';
import { DEFAULT_EXPORT_PREFERENCES } from '@chartsia/core/export';
import { shop } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test('el menú Exportar usa las preferencias de la sección Exportación', async ({ page, agent }) => {
  try {
    await page.goto('/config/exportacion');
    await page.getByRole('group', { name: 'Fondo' }).getByText('Transparente').click();
    await page.getByRole('group', { name: 'Incluir el título en la imagen' }).getByText('Sí').click();
    await page.getByRole('group', { name: 'Formato por defecto' }).getByText('draw.io').click();
    await expect(page.getByRole('group', { name: 'Formato por defecto' }).getByRole('radio', { name: 'draw.io' })).toBeChecked();

    const id = await agent.create({ ...shop, title: 'Con preferencias' });
    await page.goto(`/d/${id}`);
    await page.getByText('Exportar', { exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /draw\.io.*por defecto/ })).toBeVisible();
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /SVG/ }).click()]);
    const svg = await readFile((await file.path())!, 'utf8');
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('>Con preferencias</text>');
    expect(svg).not.toContain('fill="#ffffff"/>');
  } finally {
    await page.request.put('/api/preferences/export', { data: DEFAULT_EXPORT_PREFERENCES });
  }
});
