import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutDiagram } from '../../src/layout/index.js';
import { type Diagram, DiagramInputSchema } from '../../src/model/index.js';
import { validateDiagram } from '../../src/validation/index.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'golden', 'fixtures');

/** Nombres de todos los fixtures golden (sin extensión), en orden alfabético. */
export function fixtureNames(): string[] {
  return readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

/** Carga un fixture golden, lo valida y le calcula el layout con id y fechas fijos. */
export async function loadFixture(name: string): Promise<Diagram> {
  const raw = JSON.parse(readFileSync(join(fixturesDir, `${name}.json`), 'utf8'));
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
