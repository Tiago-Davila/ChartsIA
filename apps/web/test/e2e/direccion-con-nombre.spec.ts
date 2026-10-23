import { library } from './support/fake-agent';
import { direccionDe } from './support/rutas';
import { expect, test } from './support/fixtures';

/** Dirección del hub con el nombre de la app (`chartsia.localhost`), que resuelve a loopback. */
function enChartsia(baseURL: string | undefined, ruta: string): string {
  return new URL(ruta, (baseURL ?? '').replace('127.0.0.1', 'chartsia.localhost')).toString();
}

test.describe('dirección con el nombre de la app y del diagrama', () => {
  test('abre un diagrama por chartsia.localhost con la dirección legible y el título de la pestaña', async ({ page, agent, baseURL }) => {
    const id = await agent.create({ ...library, title: 'Biblioteca' });
    await page.goto(enChartsia(baseURL, `/d/${id}`));
    await expect(page.getByRole('heading', { name: /Biblioteca/ })).toBeVisible();
    await expect(page).toHaveURL(direccionDe(id));
    await expect(page).toHaveTitle('Biblioteca · ChartsIA');
    expect(new URL(page.url()).hostname).toBe('chartsia.localhost');
  });

  test('una dirección vieja con el id sigue abriendo el diagrama y queda en la nueva', async ({ page, agent, baseURL }) => {
    const id = await agent.create({ ...library, title: 'Dirección vieja' });
    await page.goto(`${baseURL}/d/${id}`);
    await expect(page.getByRole('heading', { name: /Dirección vieja/ })).toBeVisible();
    await expect(page).toHaveURL(direccionDe(id));
  });

  test('el slug es decorativo: otro slug con el id correcto abre el mismo diagrama', async ({ page, agent, baseURL }) => {
    const id = await agent.create({ ...library, title: 'Real' });
    await page.goto(`${baseURL}/d/cualquier-cosa-${id.slice(3)}`);
    await expect(page.getByRole('heading', { name: /Real/ })).toBeVisible();
    await expect(page).toHaveURL(direccionDe(id));
  });

  test('cambiar el título actualiza la dirección y la pestaña', async ({ page, agent, baseURL }) => {
    const id = await agent.create({ ...library, title: 'Título viejo' });
    await page.goto(`${baseURL}/d/${id}`);
    await expect(page.getByRole('heading', { name: /Título viejo/ })).toBeVisible();
    await agent.apply([{ op: 'set_title', title: 'Renombrado por el agente' }], id);
    await expect(page).toHaveURL(/\/d\/renombrado-por-el-agente-[a-z2-7]{12}$/);
    await expect(page).toHaveTitle('Renombrado por el agente · ChartsIA');
  });

  test('dos diagramas con el mismo título tienen direcciones distintas', async ({ page, agent, baseURL }) => {
    const primero = await agent.create({ ...library, title: 'Copia' });
    const segundo = await agent.create({ ...library, title: 'Copia' });
    await page.goto(`${baseURL}/d/${primero}`);
    await expect(page).toHaveURL(direccionDe(primero));
    await page.goto(`${baseURL}/d/${segundo}`);
    await expect(page).toHaveURL(direccionDe(segundo));
    expect(direccionDe(primero).source).not.toBe(direccionDe(segundo).source);
  });

  test('la configuración y la lista llevan solo el nombre de la app en la pestaña', async ({ page, agent, baseURL }) => {
    await agent.create({ ...library, title: 'Biblioteca' });
    await page.goto(`${baseURL}/config`);
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
    await expect(page).toHaveTitle('ChartsIA');
  });
});
