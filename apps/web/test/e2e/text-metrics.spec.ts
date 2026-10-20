import { library, shop } from './support/fake-agent';
import { expect, test } from './support/fixtures';

/**
 * El núcleo dimensiona las formas con tablas de métricas fijas (T048). Aquí se comprueba
 * con las fuentes reales (T101) que todo texto cabe en su forma.
 */
test('el texto medido en el DOM cabe en su forma', async ({ page, agent }) => {
  const long = {
    ...library,
    title: 'Métricas',
    elements: [
      ...library.elements,
      { id: 'Largo', kind: 'class', name: 'ServicioDeNotificacionesWWMM', attributes: [{ name: 'configuracionMuyDetallada', type: 'Map<String, List<Integer>>', visibility: '#' }], operations: [] },
    ],
  };
  for (const input of [long, { ...shop, title: 'C4' }]) {
    const id = await agent.create(input);
    await page.goto(`/d/${id}`);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => {
      const out: string[] = [];
      for (const svg of document.querySelectorAll<SVGSVGElement>('[data-testid^="shape-"]')) {
        const width = Number(svg.getAttribute('width'));
        for (const text of svg.querySelectorAll<SVGTextElement>('text')) {
          const box = text.getBBox();
          if (box.x < -0.5 || box.x + box.width > width + 0.5) out.push(`${svg.dataset.testid}: "${text.textContent}" ${box.x.toFixed(1)}+${box.width.toFixed(1)} > ${width}`);
        }
      }
      return out;
    });
    expect(overflow).toEqual([]);
  }
});
