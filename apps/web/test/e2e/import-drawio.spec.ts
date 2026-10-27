import { idDesdeUrl } from './support/rutas';
import { shop } from './support/fake-agent';
import { expect, test } from './support/fixtures';

const XML = [
  '<mxfile><diagram name="Servidores"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>',
  '<mxCell id="A" value="Servidor" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="60" width="120" height="60" as="geometry"/></mxCell>',
  '<mxCell id="B" value="Cliente" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="320" y="60" width="120" height="60" as="geometry"/></mxCell>',
  '<mxCell id="C" value="HTTPS" style="endArrow=classic;" edge="1" parent="1" source="B" target="A"><mxGeometry relative="1" as="geometry"/></mxCell>',
  '<mxCell id="D" value="Base" style="shape=cylinder3;" vertex="1" parent="1"><mxGeometry x="40" y="200" width="60" height="80" as="geometry"/></mxCell>',
  '</root></mxGraphModel></diagram></mxfile>',
].join('');

// Con el hub vacío la app muestra la pantalla inicial sin el botón "+ Nuevo": se parte de un diagrama cualquiera.
test.beforeEach(async ({ agent }) => {
  await agent.create({ type: 'class', title: 'Diagrama base', elements: [], relations: [] });
});

test('importa draw.io pegando el XML en el formulario del menú + Nuevo y lo persiste', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar draw.io' }).click();
  await page.getByLabel('XML de draw.io').fill(XML);
  await page.getByLabel('Título (opcional)').fill('Servidores importados');
  await page.getByRole('button', { name: 'Importar' }).click();

  await expect(page.getByRole('heading', { name: /Servidores importados/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /cylinder3/ })).toBeVisible();
  await page.getByRole('button', { name: 'Listo' }).click();
  const id = idDesdeUrl(page.url());
  expect(id).toBeTruthy();
  const stored = await (await page.request.get(`/api/diagrams/${id}`)).json();
  expect(stored).toMatchObject({
    title: 'Servidores importados',
    elements: [
      { id: 'A', name: 'Servidor', layout: { x: 40, y: 60 } },
      { id: 'B', name: 'Cliente', layout: { x: 320, y: 60 } },
    ],
    relations: [{ kind: 'connector', label: 'HTTPS', source: 'B', target: 'A' }],
  });
  expect(stored.elements).toHaveLength(2);

  await page.reload();
  await expect(page.getByRole('heading', { name: /Servidores importados/ })).toBeVisible();
  await expect(page.getByText('Servidor', { exact: true })).toBeVisible();
});

test('elige un archivo .drawio exportado por ChartsIA y conserva elementos, relaciones y posiciones', async ({ page, agent }) => {
  const original = await agent.create({ ...shop, title: 'Tienda original' });
  const exported = await (await page.request.get(`/api/diagrams/${original}/export?format=drawio`)).text();
  const before = await (await page.request.get(`/api/diagrams/${original}`)).json();

  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar draw.io' }).click();
  await page.getByLabel('Archivo .drawio o .xml').setInputFiles({ name: 'tienda.drawio', mimeType: 'text/xml', buffer: Buffer.from(exported) });
  await expect(page.getByText('tienda.drawio')).toBeVisible();
  await page.getByLabel('Título (opcional)').fill('Tienda reimportada');
  await page.getByRole('button', { name: 'Importar' }).click();

  await expect(page.getByRole('heading', { name: /Tienda reimportada/ })).toBeVisible();
  const id = idDesdeUrl(page.url());
  expect(id).toBeTruthy();
  expect(id).not.toBe(original);
  const after = await (await page.request.get(`/api/diagrams/${id}`)).json();
  const essence = (d: { elements: { id: string; kind: string; layout: { x: number; y: number } }[]; relations: { id: string; kind: string; source: string; target: string }[] }) => ({
    elements: d.elements.map((e) => ({ id: e.id, kind: e.kind, x: e.layout.x, y: e.layout.y })).sort((a, b) => (a.id < b.id ? -1 : 1)),
    relations: d.relations.map((r) => ({ id: r.id, kind: r.kind, source: r.source, target: r.target })).sort((a, b) => (a.id < b.id ? -1 : 1)),
  });
  expect(essence(after)).toEqual(essence(before));
});

test('rechaza un XML con DOCTYPE, muestra el error y conserva el texto para corregirlo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Importar draw.io' }).click();
  const source = '<!DOCTYPE x [<!ENTITY e "boom">]><mxGraphModel><root/></mxGraphModel>';
  await page.getByLabel('XML de draw.io').fill(source);
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByLabel('XML de draw.io')).toHaveValue(source);
  await expect(page.getByRole('form', { name: 'Importar draw.io' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('DOCTYPE');
});

test('Ctrl+V de lo copiado en draw.io sobre el lienzo lo importa como diagrama nuevo', async ({ page, agent }) => {
  const original = await agent.create({ ...shop, title: 'Lienzo base' });
  await page.goto(`/d/${original}`);
  await expect(page.getByRole('heading', { name: /Lienzo base/ })).toBeVisible();
  // draw.io copia el mxGraphModel en el portapapeles del sistema, a veces codificado como URL.
  const clipboard = encodeURIComponent('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="P" value="Pegado" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>');
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, clipboard);

  await expect(page.getByRole('heading', { name: /Diagrama importado/ })).toBeVisible();
  const id = idDesdeUrl(page.url());
  expect(id).toBeTruthy();
  expect(id).not.toBe(original);
  const stored = await (await page.request.get(`/api/diagrams/${id}`)).json();
  expect(stored.elements).toMatchObject([{ id: 'P', name: 'Pegado', layout: { x: 10, y: 20 } }]);
});
