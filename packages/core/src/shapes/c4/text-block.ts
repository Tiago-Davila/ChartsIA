import { lineHeight, measureText, wrapText } from '../text-metrics.js';
import { FONT, type Primitive } from '../types.js';

export const C4_WIDTH = 220;
export const C4_MIN_HEIGHT = 110;
const PAD_X = 14;
const MAX_DESCRIPTION_LINES = 4;

export interface C4Text {
  name: string;
  typeLabel: string;
  description?: string;
}

function layoutLines(text: C4Text, width: number) {
  const inner = width - PAD_X * 2;
  const nameLines = wrapText(text.name, inner, { size: FONT.c4Name, bold: true }, 2);
  const descLines = text.description ? wrapText(text.description, inner, { size: FONT.c4Description }, MAX_DESCRIPTION_LINES) : [];
  return { nameLines, descLines };
}

/** Ancho mínimo para que el nombre y la etiqueta de tipo quepan sin partir palabras largas. */
export function c4Width(text: C4Text): number {
  const typeWidth = measureText(text.typeLabel, { size: FONT.c4Type });
  return Math.max(C4_WIDTH, Math.ceil(typeWidth + PAD_X * 2));
}

export function c4TextHeight(text: C4Text, width: number): number {
  const { nameLines, descLines } = layoutLines(text, width);
  return (
    nameLines.length * lineHeight(FONT.c4Name) +
    lineHeight(FONT.c4Type) +
    (descLines.length > 0 ? 6 + descLines.length * lineHeight(FONT.c4Description) : 0)
  );
}

/** Nombre en negrita, "[Tipo: tecnología]" y descripción, centrados en el área dada. */
export function c4TextPrimitives(
  text: C4Text,
  area: { x: number; y: number; width: number; height: number },
  color: string,
): Primitive[] {
  const { nameLines, descLines } = layoutLines(text, area.width);
  const total = c4TextHeight(text, area.width);
  const cx = area.x + area.width / 2;
  let y = area.y + Math.max(0, (area.height - total) / 2);
  const out: Primitive[] = [];
  const push = (t: string, size: number, extra: Partial<Primitive & { type: 'text' }>) => {
    const lh = lineHeight(size);
    out.push({ type: 'text', x: cx, y: y + lh * 0.75, text: t, size, color, anchor: 'middle', ...extra });
    y += lh;
  };
  nameLines.forEach((l, i) => push(l, FONT.c4Name, { bold: true, ...(i === 0 ? { slot: 'name' } : {}) }));
  push(text.typeLabel, FONT.c4Type, { slot: 'type' });
  if (descLines.length > 0) y += 6;
  descLines.forEach((l, i) => push(l, FONT.c4Description, i === 0 ? { slot: 'description' } : {}));
  return out;
}

export function typeLabel(kind: string, technology?: string): string {
  return technology ? `[${kind}: ${technology}]` : `[${kind}]`;
}
