import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS, type ExportFormat, type ExportSettings, exportDiagram } from '../../src/export/index.js';
import { layoutDiagram } from '../../src/layout/index.js';
import { type Diagram, DiagramInputSchema, mergePreferences, DEFAULT_PREFERENCES, type PreferenceChanges, withPreferences } from '../../src/model/index.js';
import { validateDiagram } from '../../src/validation/index.js';

// Regenerar solo con revisión explícita del diff: `pnpm --filter @chartsia/core test:golden -u`.
const here = dirname(fileURLToPath(import.meta.url));
const fixtures = ['library-class', 'shop-c4-container', 'uml-members', 'shop-er', 'shop-er-tables', 'shop-er-chen', 'er-figures', 'figures', 'images', 'connectors', 'styled-class', 'styled-c4', 'styled-er', 'nosql', 'flow', 'frames', 'mixed', 'text-blocks'];

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

// Variantes de exportación: mismo diagrama y otras opciones; solo se generan los formatos donde la opción cambia algo.
const exportVariants: { name: string; fixture: string; settings: Partial<ExportSettings>; formats: ExportFormat[] }[] = [
  { name: 'library-class-transparent', fixture: 'library-class', settings: { background: 'transparent' }, formats: ['svg', 'drawio', 'excalidraw'] },
  { name: 'library-class-margin-0', fixture: 'library-class', settings: { margin: 0 }, formats: ['svg'] },
  { name: 'library-class-margin-64', fixture: 'library-class', settings: { margin: 64 }, formats: ['svg'] },
  { name: 'library-class-scale-2', fixture: 'library-class', settings: { scale: 2 }, formats: ['svg'] },
  { name: 'library-class-title', fixture: 'library-class', settings: { includeTitle: true }, formats: ['svg'] },
  { name: 'shop-c4-container-title-transparent', fixture: 'shop-c4-container', settings: { includeTitle: true, background: 'transparent', margin: 40 }, formats: ['svg'] },
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

describe.each(exportVariants)('golden exportación $name', ({ name, fixture, settings, formats }) => {
  it.each(formats)('%s', async (format) => {
    const out = exportDiagram(await load(fixture), format, { ...DEFAULT_EXPORT_SETTINGS, ...settings });
    await expect(out.content).toMatchFileSnapshot(join(here, 'expected', `${name}.${format}`));
  });
});
