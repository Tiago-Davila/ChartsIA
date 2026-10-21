import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { escapeXml } from '../../../src/export/xml-escape.js';
import { layoutDiagram } from '../../../src/layout/index.js';
import type { Diagram } from '../../../src/model/index.js';

const EVIL = '<img src=x onerror=alert(1)>';
const TRICKY = ']]>&"\'';

async function evilDiagram(): Promise<Diagram> {
  return layoutDiagram({
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title: `${EVIL} ${TRICKY}`,
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    elements: [
      { id: 'A', kind: 'class', name: EVIL, stereotype: TRICKY,
        attributes: [{ name: TRICKY, type: EVIL, visibility: '+' }], operations: [] },
      { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
    ],
    relations: [{ id: 'r', kind: 'association', source: 'A', target: 'B', label: EVIL }],
  });
}

describe('escape de texto en exportaciones', () => {
  it('escapeXml escapa los cinco caracteres especiales', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
  });

  it('escapeXml elimina caracteres de control no válidos en XML', () => {
    expect(escapeXml('a\u0000b\u0007c\td')).toBe('abc\td');
  });

  it.each(['svg', 'drawio'] as const)(
    '%s: el nombre malicioso aparece escapado y sin DOCTYPE/ENTITY',
    async (format) => {
      const out = exportDiagram(await evilDiagram(), format).content;
      expect(out).not.toContain('<img');
      expect(out).not.toContain(']]>');
      expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(out).not.toMatch(/<!DOCTYPE|<!ENTITY|<script/i);
    },
  );

  it('drawio: el modelo interno (atributo value) también va escapado', async () => {
    const out = exportDiagram(await evilDiagram(), 'drawio').content;
    expect(out).not.toMatch(/value="[^"]*<img/);
  });

  it('excalidraw: el texto se conserva literal dentro de JSON válido', async () => {
    const out = exportDiagram(await evilDiagram(), 'excalidraw').content;
    const json = JSON.parse(out);
    const texts = json.elements.filter((e: { type: string }) => e.type === 'text').map((e: { text: string }) => e.text);
    expect(texts.some((t: string) => t.includes(EVIL))).toBe(true);
  });
});

describe('escape en diagramas er', () => {
  async function evilEr(): Promise<Diagram> {
    return layoutDiagram({
      id: 'dg_aaaaaaaaaaaa', type: 'er', title: EVIL, revision: 1,
      createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
      elements: [
        { id: 'A', kind: 'entity', name: EVIL, weak: true },
        { id: 'B', kind: 'entity', name: TRICKY },
      ],
      relations: [{ id: 'r', kind: 'er-rel', source: 'A', target: 'B', label: EVIL, sourceCardinality: 'zero-many', targetCardinality: 'one' }],
    });
  }

  it.each(['svg', 'drawio'] as const)('%s: nombres y etiquetas escapados', async (format) => {
    const out = exportDiagram(await evilEr(), format).content;
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('excalidraw: JSON válido con el texto literal', async () => {
    const json = JSON.parse(exportDiagram(await evilEr(), 'excalidraw').content);
    expect(json.elements.some((e: { text?: string }) => e.text?.includes(EVIL))).toBe(true);
  });
});
