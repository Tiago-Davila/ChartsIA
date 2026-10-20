import { type ElementOfKind } from '../../model/diagram.js';
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
const LABEL_HEIGHT = lineHeight(FONT.c4Name) + lineHeight(FONT.c4Type) + PAD;

/** Límite C4: rectángulo discontinuo con nombre y "[tipo]" arriba a la izquierda. */
export const boundaryShape: ShapeDefinition<BoundaryElement> = {
  padding: { top: LABEL_HEIGHT + 16, right: 24, bottom: 24, left: 24 },
  measure: (el) => {
    const label = Math.max(
      measureText(el.name, { size: FONT.c4Name, bold: true }),
      measureText(LABELS[el.boundaryType], { size: FONT.c4Type }),
    );
    return { width: Math.max(240, Math.ceil(label + PAD * 2)), height: LABEL_HEIGHT + 80 };
  },
  primitives: (el, { width, height }) => {
    const c = C4_PALETTE.boundary;
    const nameY = PAD + lineHeight(FONT.c4Name) * 0.75;
    return [
      { type: 'rect', x: 0, y: 0, width, height, rx: 8, fill: 'none', stroke: c.stroke, strokeWidth: 1.5, dash: [8, 5] },
      { type: 'text', x: PAD, y: nameY, text: el.name, size: FONT.c4Name, bold: true, color: c.text, anchor: 'start', slot: 'name' },
      { type: 'text', x: PAD, y: nameY + lineHeight(FONT.c4Type), text: LABELS[el.boundaryType], size: FONT.c4Type, color: c.text, anchor: 'start', slot: 'type' },
    ];
  },
};
