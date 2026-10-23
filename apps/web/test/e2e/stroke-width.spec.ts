import { library } from './support/fake-agent';
import { expect, test } from './support/fixtures';

type Saved = { id: string; kind: string; strokeWidth?: number; style?: Record<string, unknown> };
const elementos = async (agent: { layout(id: string): Promise<unknown> }, id: string) =>
  ((await agent.layout(id)) as { elements: Saved[] }).elements;
const relaciones = async (agent: { layout(id: string): Promise<unknown> }, id: string) =>
  ((await agent.layout(id)) as { relations: Saved[] }).relations;

test.describe('grosor de trazo', () => {
  test('elegir el grosor de una clase cambia su borde, persiste y llega al SVG exportado', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Grosor' });
    await page.goto(`/d/${id}`);
    const autor = page.locator('[data-element-id="Autor"]');
    await autor.click({ position: { x: 20, y: 8 } });

    await expect(page.getByRole('button', { name: 'Grosor: Medio' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Grosor: Grueso' }).click();
    await expect(autor.locator('rect[stroke-width="3"]').first()).toBeVisible();
    await expect.poll(async () => (await elementos(agent, id)).find((e) => e.id === 'Autor')?.style).toEqual({ lineWidth: 'thick' });
    await expect(page.getByRole('button', { name: 'Grosor: Grueso' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('[data-element-id="Autor"] rect[stroke-width="3"]').first()).toBeVisible();

    const svg = (await agent.call('export_diagram', { diagramId: id, format: 'svg' })).structuredContent!.content as string;
    expect(svg).toMatch(/data-id="Autor"[^>]*><rect[^>]*stroke-width="3"/);
  });

  test('una flecha admite grosor fino y ctrl+z lo revierte', async ({ page, agent }) => {
    const id = await agent.create({ ...library, title: 'Flecha' });
    await page.goto(`/d/${id}`);
    await page.locator('[data-testid="edge-r1"] .react-flow__edge-interaction').dispatchEvent('click');

    await page.getByRole('button', { name: 'Grosor: Fino' }).click();
    await expect.poll(async () => (await relaciones(agent, id)).find((r) => r.id === 'r1')?.style).toEqual({ lineWidth: 'thin' });
    await expect(page.locator('[data-testid="edge-r1"] path[stroke-width="1"]').first()).toBeAttached();
    await expect(page.locator('[data-testid="edge-r1"] path[stroke-width="1.5"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Grosor: Fino' })).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await relaciones(agent, id)).find((r) => r.id === 'r1')?.style).toBeUndefined();
  });

  test('el lápiz dibuja con el grosor elegido y el panel lo cambia en un trazo seleccionado', async ({ page, agent }) => {
    const id = await agent.create({ type: 'class', title: 'Lápiz', elements: [], relations: [] });
    await page.goto(`/d/${id}`);
    await page.getByRole('button', { name: 'Lápiz', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Grosor del lápiz: Medio' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Grosor del lápiz: Grueso' }).click();

    const canvas = (await page.locator('.diagram-canvas').boundingBox())!;
    await page.mouse.move(canvas.x + 300, canvas.y + 250);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 400, canvas.y + 330, { steps: 8 });
    await page.mouse.up();

    const trazo = async () => (await elementos(agent, id)).find((e) => e.kind === 'drawing');
    await expect.poll(async () => (await trazo())?.strokeWidth).toBe(5);

    // Se apaga el lápiz, se selecciona el trazo y se cambia su grosor desde el panel de estilo.
    await page.getByRole('button', { name: 'Lápiz', exact: true }).click();
    const node = page.locator(`[data-element-id="${(await trazo())!.id}"]`);
    await node.locator('svg path').click({ position: { x: 20, y: 14 } });
    await expect(page.getByRole('button', { name: 'Grosor: Grueso' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Grosor: Fino' }).click();
    await expect.poll(async () => (await trazo())?.strokeWidth).toBe(1.5);
    await expect(node.locator('svg path').first()).toHaveAttribute('stroke-width', '1.5');

    const svg = (await agent.call('export_diagram', { diagramId: id, format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('stroke-width="1.5"');
  });

  test('el marcador tiene sus propios grosores', async ({ page, agent }) => {
    const id = await agent.create({ type: 'class', title: 'Marcador', elements: [], relations: [] });
    await page.goto(`/d/${id}`);
    await page.getByRole('button', { name: 'Marcador', exact: true }).click();
    await page.getByRole('button', { name: 'Grosor del marcador: Grueso' }).click();

    const canvas = (await page.locator('.diagram-canvas').boundingBox())!;
    await page.mouse.move(canvas.x + 300, canvas.y + 250);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 400, canvas.y + 330, { steps: 8 });
    await page.mouse.up();

    await expect.poll(async () => (await elementos(agent, id)).find((e) => e.kind === 'drawing')?.strokeWidth).toBe(16);
  });
});
