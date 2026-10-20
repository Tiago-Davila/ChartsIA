import { type ElementOfKind } from '../../model/diagram.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type ShapeDefinition } from '../types.js';

type PackageElement = ElementOfKind<'package'>;

const TAB_PAD = 10;
const TAB_HEIGHT = lineHeight(FONT.name) + 6;

function tabWidth(el: PackageElement): number {
  return Math.max(60, Math.ceil(measureText(el.name, { size: FONT.name, bold: true }) + TAB_PAD * 2));
}

/** Paquete UML: pestaña con el nombre y cuerpo que contiene a sus elementos. */
export const packageShape: ShapeDefinition<PackageElement> = {
  padding: { top: TAB_HEIGHT + 20, right: 20, bottom: 20, left: 20 },
  measure: (el) => ({ width: Math.max(160, tabWidth(el) + 40), height: TAB_HEIGHT + 60 }),
  primitives: (el, { width, height }) => {
    const tab = Math.min(tabWidth(el), width);
    return [
      { type: 'rect', x: 0, y: 0, width: tab, height: TAB_HEIGHT, fill: COLORS.umlHeader, stroke: COLORS.stroke, strokeWidth: 1.5 },
      { type: 'rect', x: 0, y: TAB_HEIGHT, width, height: height - TAB_HEIGHT, fill: 'none', stroke: COLORS.stroke, strokeWidth: 1.5 },
      { type: 'text', x: TAB_PAD, y: TAB_HEIGHT - 8, text: el.name, size: FONT.name, bold: true, color: COLORS.text, anchor: 'start', slot: 'name' },
    ];
  },
};
