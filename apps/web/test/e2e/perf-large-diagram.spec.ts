import { expect, test } from './support/fixtures';

function large(n: number) {
  const elements = Array.from({ length: n }, (_, i) => ({
    id: `C${i}`, kind: 'class', name: `Clase${i}`,
    attributes: [{ name: 'id', type: 'UUID', visibility: '-' }], operations: [{ name: 'guardar', parameters: [], visibility: '+' }],
  }));
  const relations = Array.from({ length: n - 1 }, (_, i) => ({ id: `r${i}`, kind: 'association', source: `C${i + 1}`, target: `C${Math.floor(i / 3)}` }));
  return { type: 'class', title: `Grande ${n}`, elements, relations };
}

// La grabación de trazas de Playwright (capturas en cada acción) compite por la CPU con el
// render y falsea la medida: este test se ejecuta sin trazas.
test.use({ trace: 'off' });

test('SC-006: 200 elementos, pan y zoom sostenidos ≥ 50 fps', async ({ page, agent }) => {
  const id = await agent.create(large(200));
  await page.goto(`/d/${id}`);
  await expect(page.locator('.react-flow__node')).toHaveCount(200);
  await page.waitForTimeout(500);

  const pane = (await page.locator('.react-flow__pane').boundingBox())!;
  const cx = pane.x + pane.width / 2;
  const cy = pane.y + pane.height / 2;

  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    const tick = (t: number) => {
      w.__frames.push(t);
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Pan con arrastre y zoom con rueda durante ~2 s.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < 40; i++) await page.mouse.move(cx + Math.sin(i / 5) * 200, cy + Math.cos(i / 5) * 120, { steps: 2 });
  await page.mouse.up();
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, i < 10 ? -120 : 120);
    await page.waitForTimeout(30);
  }

  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
  const deltas = frames.slice(1).map((t, i) => t - frames[i]!);
  const sorted = [...deltas].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
  const fps = 1000 / (deltas.reduce((s, d) => s + d, 0) / deltas.length);
  test.info().annotations.push({ type: 'fps', description: `media ${fps.toFixed(1)} fps, p90 ${p90.toFixed(1)} ms/frame` });
  expect(fps).toBeGreaterThanOrEqual(50);
});
