import { type DiagramContent } from '../../model/diagram.js';
import { isC4Diagram } from '../../model/enums.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { FONT, type Primitive, type Size } from '../types.js';
import { C4_PALETTE } from './palette.js';

export interface LegendEntry {
  key: 'person' | 'software-system' | 'container' | 'component' | 'external' | 'boundary' | 'relationship';
  label: string;
  fill: string;
  stroke: string;
  text: string;
  dashed?: boolean;
}

const ORDER: LegendEntry['key'][] = ['person', 'software-system', 'container', 'component', 'external', 'boundary', 'relationship'];
const LABELS: Record<LegendEntry['key'], string> = {
  person: 'Persona',
  'software-system': 'Sistema de software',
  container: 'Contenedor',
  component: 'Componente',
  external: 'Externo',
  boundary: 'Límite',
  relationship: 'Relación',
};

/** Entradas de la leyenda C4 (FR-015) solo para lo que aparece en el diagrama. */
export function legendEntries(diagram: DiagramContent): LegendEntry[] {
  if (!isC4Diagram(diagram.type)) return [];
  const present = new Set<LegendEntry['key']>();
  for (const el of diagram.elements) {
    if ('external' in el && el.external) present.add('external');
    else present.add(el.kind as LegendEntry['key']);
  }
  if (diagram.relations.length > 0) present.add('relationship');
  return ORDER.filter((k) => present.has(k)).map((key) => {
    if (key === 'relationship') return { key, label: LABELS[key], fill: 'none', stroke: '#707070', text: '#333333', dashed: true };
    const p = C4_PALETTE[key];
    return { key, label: LABELS[key], fill: p.fill, stroke: p.stroke, text: p.text, ...(key === 'boundary' ? { dashed: true } : {}) };
  });
}

const SWATCH = 18;
const ROW = lineHeight(FONT.c4Description) + 6;
const PAD = 10;

/** Leyenda como bloque de primitivas, para el SVG exportado. */
export function legendPrimitives(entries: LegendEntry[]): { size: Size; primitives: Primitive[] } {
  const title = 'Leyenda';
  const textWidth = Math.max(
    measureText(title, { size: FONT.c4Description, bold: true }),
    ...entries.map((e) => measureText(e.label, { size: FONT.c4Description })),
  );
  const width = Math.ceil(PAD * 3 + SWATCH + textWidth);
  const height = PAD * 2 + ROW * (entries.length + 1);
  const out: Primitive[] = [
    { type: 'rect', x: 0, y: 0, width, height, rx: 6, fill: '#ffffff', stroke: '#c0c0c0' },
    { type: 'text', x: PAD, y: PAD + ROW * 0.7, text: title, size: FONT.c4Description, bold: true, color: '#333333', anchor: 'start' },
  ];
  entries.forEach((e, i) => {
    const top = PAD + ROW * (i + 1);
    if (e.key === 'relationship') {
      out.push({ type: 'line', x1: PAD, y1: top + ROW / 2, x2: PAD + SWATCH, y2: top + ROW / 2, stroke: e.stroke, strokeWidth: 1.5, dash: [4, 3] });
    } else {
      out.push({
        type: 'rect', x: PAD, y: top + (ROW - SWATCH) / 2, width: SWATCH, height: SWATCH, rx: 3,
        fill: e.fill === 'none' ? '#ffffff' : e.fill, stroke: e.stroke, ...(e.dashed ? { dash: [4, 3] } : {}),
      });
    }
    out.push({ type: 'text', x: PAD * 2 + SWATCH, y: top + ROW * 0.68, text: e.label, size: FONT.c4Description, color: '#333333', anchor: 'start' });
  });
  return { size: { width, height }, primitives: out };
}
