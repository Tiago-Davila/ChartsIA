import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { layoutDiagram } from '../../../src/layout/index.js';

describe('escape de columnas de tabla', () => {
  it.each(['svg', 'drawio', 'excalidraw'] as const)('%s: tipos con < & y comillas no se cuelan sin escapar', async (format) => {
    const d = await layoutDiagram({
      id: 'dg_aaaaaaaaaaaa', type: 'er', title: 't', revision: 1,
      createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
      elements: [{ id: 'T', kind: 'table', name: 'T', columns: [{ name: 'a"b', type: 'Map<K,V> & <img src=x>', pk: true }] }],
      relations: [],
    });
    const out = exportDiagram(d, format).content;
    // Excalidraw es JSON (el texto va literal dentro de un string); SVG y draw.io son XML y deben escapar.
    if (format === 'excalidraw') {
      expect(JSON.parse(out).elements.some((e: { text?: string }) => e.text?.includes('Map<K,V> & <img src=x>'))).toBe(true);
    } else {
      expect(out).not.toContain('<img');
      expect(out).toContain('Map&lt;K,V&gt; &amp; &lt;img');
    }
  });
});
