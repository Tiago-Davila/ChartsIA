import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../src/export/index.js';
import { layoutDiagram } from '../../src/layout/index.js';
import { type Diagram, DiagramInputSchema, mergePreferences, DEFAULT_PREFERENCES, type PreferenceChanges, withPreferences } from '../../src/model/index.js';
import { validateDiagram } from '../../src/validation/index.js';

// Regenerar solo con revisión explícita del diff: `pnpm --filter @chartsia/core test:golden -u`.
const here = dirname(fileURLToPath(import.meta.url));
const fixtures = ['library-class', 'shop-c4-container', 'uml-members', 'shop-er', 'shop-er-tables', 'shop-er-chen', 'er-figures', 'figures', 'images', 'connectors', 'styled-class', 'styled-c4', 'styled-er', 'nosql', 'frames', 'mixed', 'text-blocks'];

// Variantes con preferencias de diagrama: mismo fixture, otra salida.
const variants: { name: string; fixture: string; preferences: PreferenceChanges }[] = [
  { name: 'library-class-right', fixture: 'library-class', preferences: { direction: 'right', elementSpacing: 'wide', layerSpacing: 'compact' } },
  { name: 'library-class-minimal', fixture: 'library-class', preferences: { uml: { types: false, visibility: false, multiplicities: false, methods: false } } },
  { name: 'uml-members-minimal', fixture: 'uml-members', preferences: { uml: { types: false, visibility: false, multiplicities: false, methods: false } } },
  {
    name: 'shop-c4-container-preferences',
    fixture: 'shop-c4-container',
    preferences: { c4Legend: false, fontFamily: 'handwritten', palette: { person: { fillColor: '#fde68a', borderColor: '#92400e' } } },
  },
];

async function load(name: string, preferences?: PreferenceChanges): Promise<Diagram> {
  const raw = JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8'));
  const res = validateDiagram(raw, { schema: DiagramInputSchema });
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  const content = preferences ? withPreferences(res.value, mergePreferences(DEFAULT_PREFERENCES, preferences)) : res.value;
  return layoutDiagram({
    ...content,
    id: 'dg_goldengolden',
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
  });
}

describe.each([...fixtures.map((name) => ({ name, fixture: name, preferences: undefined })), ...variants])('golden $name', ({ name, fixture, preferences }) => {
  const expected = (file: string) => join(here, 'expected', `${name}.${file}`);

  it('layout', async () => {
    const d = await load(fixture, preferences);
    await expect(JSON.stringify(d, null, 2) + '\n').toMatchFileSnapshot(expected('layout.json'));
  });

  it.each(['svg', 'drawio', 'excalidraw'] as const)('%s', async (format) => {
    const d = await load(fixture, preferences);
    const out = exportDiagram(d, format);
    await expect(out.content).toMatchFileSnapshot(expected(format));
  });
});
