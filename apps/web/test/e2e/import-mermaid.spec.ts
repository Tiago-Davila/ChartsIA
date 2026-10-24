import { idDesdeUrl } from './support/rutas';
import { expect, test } from './support/fixtures';

test('importa Mermaid desde la app, persiste clases y relaciones y las renderiza tras recargar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar Mermaid' }).click();
  await page.getByLabel('Mermaid classDiagram').fill([
    'classDiagram',
    'class Usuario {',
    '  +String nombre',
    '  +iniciarSesion() bool',
    '}',
    'class Sesion',
    'Usuario "1" --> "0..*" Sesion : crea',
    'API ()-- Usuario',
  ].join('\n'));
  await page.getByLabel('Título (opcional)').fill('Usuarios importados');
  await page.getByRole('button', { name: 'Importar' }).click();

  await expect(page.getByRole('heading', { name: /Usuarios importados/ })).toBeVisible();
  await expect(page.getByText('Usuario', { exact: true })).toBeVisible();
  await expect(page.getByText('Sesion', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /lollipop/ })).toBeVisible();
  await page.getByRole('button', { name: 'Listo' }).click();
  const id = idDesdeUrl(page.url());
  expect(id).toBeTruthy();
  const stored = await (await page.request.get(`/api/diagrams/${id}`)).json();
  expect(stored).toMatchObject({
    title: 'Usuarios importados',
    elements: [
      { name: 'Usuario', operations: [{ name: 'iniciarSesion', returnType: 'bool' }] },
      { name: 'Sesion' },
      { name: 'API', kind: 'interface' },
    ],
    relations: [{ kind: 'association', label: 'crea' }, { kind: 'realization' }],
  });

  await page.reload();
  await expect(page.getByRole('heading', { name: /Usuarios importados/ })).toBeVisible();
  await expect(page.getByText('Usuario', { exact: true })).toBeVisible();
  await expect(page.getByText('Sesion', { exact: true })).toBeVisible();
});

test('al rechazar sintaxis conserva el texto para corregirlo y muestra el error accionable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar Mermaid' }).click();
  const source = 'graph TD\nA --> B';
  await page.getByLabel('Mermaid classDiagram').fill(source);
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByLabel('Mermaid classDiagram')).toHaveValue(source);
  await expect(page.getByRole('form', { name: 'Importar Mermaid' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Línea 1');
  await expect(page.getByRole('alert')).toContainText('classDiagram');
});

test('trata HTML y callbacks de Mermaid como texto inerte', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar Mermaid' }).click();
  const label = '<img src=x onerror=window.__chartsiaPwned=true>';
  await page.getByLabel('Mermaid classDiagram').fill([
    'classDiagram',
    `class Safe["${label}"]`,
    'click Safe href "javascript:window.__chartsiaPwned=true" "malicioso"',
  ].join('\n'));
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByRole('heading', { name: 'Diagrama importado' })).toBeVisible();
  await expect(page.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { __chartsiaPwned?: boolean }).__chartsiaPwned)).toBeUndefined();
  const id = idDesdeUrl(page.url());
  const stored = await (await page.request.get(`/api/diagrams/${id}`)).json();
  expect(JSON.stringify(stored)).not.toContain('javascript:');
  expect(stored.elements[0].name).toBe(label);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
});
