import { readFile } from 'node:fs/promises';
import { expect, test } from './support/fixtures';

test('pegar y arrastrar imágenes las persiste y exporta incrustadas', async ({ page, agent }) => {
  const id = await agent.create({ type: 'class', title: 'Imágenes', elements: [], relations: [] });
  await page.goto(`/d/${id}`);
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#cf5338';
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = '#2876a8';
    context.fillRect(1, 0, 1, 1);
    return {
      png: canvas.toDataURL('image/png').split(',')[1]!,
      jpeg: canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!,
    };
  });

  // Pega un archivo de imagen en la app como lo haría el portapapeles.
  const paste = (name: string, type: string, base64: string) =>
    page.evaluate(({ name, type, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type }));
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer });
      document.querySelector('.app-shell__main')!.dispatchEvent(event);
    }, { name, type, base64 });

  await paste('pegada.png', 'image/png', encoded.png);
  await expect.poll(async () => (await agent.layout(id)).elements.filter((element) => element.kind === 'image').length).toBe(1);

  await paste('pegada.jpg', 'image/jpeg', encoded.jpeg);
  await expect.poll(async () => (await agent.layout(id)).elements.filter((element) => element.kind === 'image').length).toBe(2);

  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#48a36b"/></svg>';
  await page.evaluate((source) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([source], 'arrastrada.svg', { type: 'image/svg+xml' }));
    document.querySelector('.app-shell__canvas')!.dispatchEvent(new DragEvent('drop', {
      bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 200, clientY: 200,
    }));
  }, svg);
  await expect.poll(async () => (await agent.layout(id)).elements.filter((element) => element.kind === 'image').length).toBe(3);
  await expect(page.locator('.app-shell__canvas .chartsia-node svg image')).toHaveCount(3);

  await page.reload();
  await expect(page.locator('.app-shell__canvas .chartsia-node svg image')).toHaveCount(3);
  const saved = await (await page.request.get(`/api/diagrams/${id}`)).json();
  const sources: string[] = saved.elements.filter((element: { kind: string }) => element.kind === 'image').map((element: { src: string }) => element.src);
  expect(sources).toHaveLength(3);
  expect(sources.map((source) => source.slice(0, source.indexOf(';')))).toEqual(['data:image/png', 'data:image/jpeg', 'data:image/svg+xml']);

  async function download(label: RegExp) {
    await page.getByText('Exportar', { exact: true }).click();
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: label }).click()]);
    return readFile((await file.path())!, 'utf8');
  }

  const svgExport = await download(/SVG/);
  for (const source of sources) expect(svgExport).toContain(source);

  const drawioExport = await download(/draw\.io/);
  const drawioImages = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return [...doc.querySelectorAll('mxCell[vertex="1"]')].map((cell) => cell.getAttribute('style') ?? '').filter((style) => style.startsWith('shape=image;image=data:image/'));
  }, drawioExport);
  expect(drawioImages).toHaveLength(3);
  expect(drawioImages.some((style) => style.includes('data:image/png,%89%50%4e%47'))).toBe(true);
  expect(drawioImages.some((style) => style.includes('data:image/jpeg,%ff%d8%ff'))).toBe(true);
  expect(drawioImages.some((style) => style.includes('data:image/svg+xml,%3c%73%76%67'))).toBe(true);
  expect(drawioImages.every((style) => style.includes(';imageAspect=1;'))).toBe(true);

  const excalidrawExport = await download(/Excalidraw/);
  const excalidraw = JSON.parse(excalidrawExport);
  const imageElements = excalidraw.elements.filter((element: { type: string }) => element.type === 'image');
  expect(imageElements).toHaveLength(3);
  expect(Object.values(excalidraw.files).map((file: unknown) => (file as { dataURL: string }).dataURL).sort()).toEqual([...sources].sort());
  expect(imageElements[2]).toMatchObject({ width: 320, height: 180, y: expect.any(Number) });
});
