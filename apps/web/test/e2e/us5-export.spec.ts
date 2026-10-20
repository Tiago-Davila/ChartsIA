import { readFile } from 'node:fs/promises';
import { shop } from './support/fake-agent';
import { expect, test } from './support/fixtures';

test.describe('US5 · escenario 8: exportar a draw.io y Excalidraw', () => {
  async function download(page: import('@playwright/test').Page, label: RegExp) {
    await page.getByText('Exportar', { exact: true }).click();
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: label }).click()]);
    return { name: file.suggestedFilename(), text: await readFile((await file.path())!, 'utf8') };
  }

  test('draw.io: XML mxGraphModel con todos los elementos y aristas conectadas', async ({ page, agent }) => {
    const id = await agent.create({ ...shop, title: 'Exportar drawio' });
    await page.goto(`/d/${id}`);
    const { name, text } = await download(page, /draw\.io/);
    expect(name).toBe('exportar-drawio.drawio');
    const doc = await page.evaluate((xml) => {
      const parsed = new DOMParser().parseFromString(xml, 'application/xml');
      if (parsed.querySelector('parsererror')) return { error: true };
      const ids = new Set([...parsed.querySelectorAll('mxCell[id], object[id]')].map((c) => c.getAttribute('id')));
      const edges = [...parsed.querySelectorAll('mxCell[edge="1"]')].map((e) => [e.getAttribute('source'), e.getAttribute('target')]);
      return { error: false, hasModel: !!parsed.querySelector('mxGraphModel'), ids: [...ids], edges };
    }, text);
    expect(doc.error).toBe(false);
    expect(doc.hasModel).toBe(true);
    for (const el of shop.elements) expect(doc.ids).toContain(el.id);
    expect(doc.edges).toHaveLength(shop.relations.length);
    for (const [s, t] of doc.edges!) {
      expect(doc.ids).toContain(s);
      expect(doc.ids).toContain(t);
    }
  });

  test('Excalidraw: JSON válido con flechas ligadas a formas existentes', async ({ page, agent }) => {
    const id = await agent.create({ ...shop, title: 'Exportar excalidraw' });
    await page.goto(`/d/${id}`);
    const { name, text } = await download(page, /Excalidraw/);
    expect(name).toBe('exportar-excalidraw.excalidraw');
    const file = JSON.parse(text);
    expect(file).toMatchObject({ type: 'excalidraw', version: 2, files: {} });
    const ids = new Set(file.elements.map((e: { id: string }) => e.id));
    const arrows = file.elements.filter((e: { type: string }) => e.type === 'arrow');
    expect(arrows).toHaveLength(shop.relations.length);
    for (const a of arrows) {
      expect(ids.has(a.startBinding.elementId)).toBe(true);
      expect(ids.has(a.endBinding.elementId)).toBe(true);
    }
    for (const t of file.elements.filter((e: { containerId?: string }) => e.containerId)) expect(ids.has(t.containerId)).toBe(true);
  });
});
