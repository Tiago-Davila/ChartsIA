import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { FONT, type ShapeDefinition } from '../types.js';
import { C4_PALETTE } from './palette.js';

type BoundaryElement = ElementOfKind<'boundary'>;

const LABELS: Record<BoundaryElement['boundaryType'], string> = {
  enterprise: '[Enterprise]',
  system: '[Software System]',
  container: '[Container]',
};
const PAD = 12;

function labelHeight(el: BoundaryElement): number {
  return lineHeight(textFont(el.style, FONT.c4Name).size) + lineHeight(textFont(el.style, FONT.c4Type).size) + PAD;
}

/** Límite C4: rectángulo discontinuo con nombre y "[tipo]" arriba a la izquierda. */
export const boundaryShape: ShapeDefinition<BoundaryElement> = {
  padding: (el) => ({ top: labelHeight(el) + 16, right: 24, bottom: 24, left: 24 }),
  measure: (el) => {
    const label = Math.max(
      measureText(el.name, { ...textFont(el.style, FONT.c4Name), bold: true }),
      measureText(LABELS[el.boundaryType], textFont(el.style, FONT.c4Type)),
    );
    return { width: Math.max(240, Math.ceil(label + PAD * 2)), height: labelHeight(el) + 80 };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, C4_PALETTE.boundary);
    const name = textFont(el.style, FONT.c4Name);
    const type = textFont(el.style, FONT.c4Type);
    const nameY = PAD + lineHeight(name.size) * 0.75;
    return [
      { type: 'rect', x: 0, y: 0, width, height, rx: 8, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth, dash: [8, 5] },
      { type: 'text', x: PAD, y: nameY, text: el.name, ...name, bold: true, color: c.text, anchor: 'start', slot: 'name' },
      { type: 'text', x: PAD, y: nameY + lineHeight(type.size), text: LABELS[el.boundaryType], ...type, color: c.text, anchor: 'start', slot: 'type' },
    ];
  },
};
