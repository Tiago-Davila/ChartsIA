import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../src/export/index.js';
import { layoutDiagram } from '../../src/layout/index.js';
import { type Diagram, DiagramInputSchema } from '../../src/model/index.js';
import { validateDiagram } from '../../src/validation/index.js';

// Regenerar solo con revisión explícita del diff: `pnpm --filter @chartsia/core test:golden -u`.
const here = dirname(fileURLToPath(import.meta.url));
const fixtures = ['library-class', 'shop-c4-container', 'uml-members', 'shop-er', 'shop-er-tables'];

async function load(name: string): Promise<Diagram> {
  const raw = JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8'));
  const res = validateDiagram(raw, { schema: DiagramInputSchema });
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return layoutDiagram({
    ...res.value,
    id: 'dg_goldengolden',
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  });
}

describe.each(fixtures)('golden %s', (name) => {
  const expected = (file: string) => join(here, 'expected', `${name}.${file}`);

  it('layout', async () => {
    const d = await load(name);
    await expect(JSON.stringify(d, null, 2) + '\n').toMatchFileSnapshot(expected('layout.json'));
  });

  it.each(['svg', 'drawio', 'excalidraw'] as const)('%s', async (format) => {
    const d = await load(name);
    const out = exportDiagram(d, format);
    await expect(out.content).toMatchFileSnapshot(expected(format));
  });
});
