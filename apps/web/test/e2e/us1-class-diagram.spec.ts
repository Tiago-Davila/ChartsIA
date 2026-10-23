import { direccionDe } from './support/rutas';
import { library, overlaps } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('US1 · escenarios 1–2: diagrama de clases vía agente', () => {
  test('aparece en la app en < 2 s, completo y sin solapes', async ({ page, agent }) => {
    await page.goto('/');
    await expect(page.getByText('Conectado al hub')).toBeVisible();
    const start = Date.now();
    const id = await agent.create(library);
    await expect(page.getByText('Préstamo', { exact: true })).toBeVisible();
    expect(Date.now() - start).toBeLessThan(2000);
    await expect(page).toHaveURL(direccionDe(id));

    // Compartimentos y visibilidad visibles.
    await expect(page.getByText('- isbn: String')).toBeVisible();
    await expect(page.getByText('+ prestar(libro: Libro): Prestamo')).toBeVisible();

    // Sin solapes entre nodos en pantalla.
    const boxes = await page.locator('.react-flow__node').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
    expect(boxes).toHaveLength(4);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);

    // Ninguna arista atraviesa un nodo que no sea su origen o destino.
    const d = await agent.layout(id);
    for (const rel of d.relations) {
      const rFull = (library.relations.find((r) => r.id === rel.id))!;
      for (const el of d.elements) {
        if (el.id === rFull.source || el.id === rFull.target) continue;
        for (let k = 0; k + 1 < rel.route.length; k++) {
          const [p, q] = [rel.route[k]!, rel.route[k + 1]!];
          const seg = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(p.x - q.x), height: Math.abs(p.y - q.y) };
          expect(overlaps(seg, el.layout), `${rel.id} atraviesa ${el.id}`).toBe(false);
        }
      }
    }
  });

  test('pedir el mismo diagrama otra vez produce el mismo layout', async ({ agent }) => {
    const a = await agent.layout(await agent.create(library));
    const b = await agent.layout(await agent.create(library));
    expect(b.elements.map((e) => e.layout)).toEqual(a.elements.map((e) => e.layout));
    expect(b.relations.map((r) => r.route)).toEqual(a.relations.map((r) => r.route));
  });

  test('viewUrl abre la app directamente en el diagrama', async ({ page, agent }) => {
    const res = await agent.call('create_diagram', { ...library, title: 'Biblioteca enlazada' });
    await page.goto(res.structuredContent!.viewUrl as string);
    await expect(page.getByRole('heading', { name: /Biblioteca enlazada/ })).toBeVisible();
    await expect(page.getByText('Autor', { exact: true })).toBeVisible();
  });
});
