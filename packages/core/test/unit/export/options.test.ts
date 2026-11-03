import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_PREFERENCES, DEFAULT_EXPORT_SETTINGS, ExportPreferenceChangesSchema, exportDiagram, mergeExportPreferences } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';

const diagram = (title: string) =>
  layoutDiagram({
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title,
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    elements: [{ id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] }],
    relations: [],
  });

const widthOf = (svg: string) => Number(/ width="(\d+)"/.exec(svg)![1]);

describe('opciones de exportación', () => {
  it('sin opciones la salida es la de las opciones por defecto', async () => {
    const d = await diagram('Corto');
    for (const format of ['svg', 'drawio', 'excalidraw'] as const) {
      expect(exportDiagram(d, format).content).toBe(exportDiagram(d, format, DEFAULT_EXPORT_SETTINGS).content);
    }
  });

  it('mergeExportPreferences cambia solo lo pedido', () => {
    expect(mergeExportPreferences(DEFAULT_EXPORT_PREFERENCES, { format: 'drawio', margin: 0 })).toEqual({ ...DEFAULT_EXPORT_PREFERENCES, format: 'drawio', margin: 0 });
  });

  it('rechaza valores fuera de rango o campos desconocidos', () => {
    for (const bad of [{ margin: -1 }, { margin: 1.5 }, { scale: 0 }, { scale: 9 }, { background: 'black' }, { format: 'png' }, { tema: 'x' }]) {
      expect(ExportPreferenceChangesSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('un título largo ensancha la imagen', async () => {
    const d = await diagram('Un título muy largo que supera el ancho de una sola clase pequeña');
    const plain = exportDiagram(d, 'svg').content;
    const withTitle = exportDiagram(d, 'svg', { ...DEFAULT_EXPORT_SETTINGS, includeTitle: true }).content;
    expect(widthOf(withTitle)).toBeGreaterThan(widthOf(plain));
  });

  it('la escala cambia el tamaño y no el viewBox', async () => {
    const d = await diagram('Escala');
    const plain = exportDiagram(d, 'svg').content;
    const doubled = exportDiagram(d, 'svg', { ...DEFAULT_EXPORT_SETTINGS, scale: 2 }).content;
    expect(widthOf(doubled)).toBe(2 * widthOf(plain));
    expect(/viewBox="([^"]+)"/.exec(doubled)![1]).toBe(/viewBox="([^"]+)"/.exec(plain)![1]);
  });
});
