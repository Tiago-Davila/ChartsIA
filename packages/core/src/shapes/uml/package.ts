import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type ShapeDefinition } from '../types.js';

type PackageElement = ElementOfKind<'package'>;

const TAB_PAD = 10;

/** Alto de la pestaña del paquete, que crece con el tamaño de fuente. */
export function tabHeight(el: PackageElement): number {
  return lineHeight(textFont(el.style, FONT.name).size) + 6;
}

function tabWidth(el: PackageElement): number {
  return Math.max(60, Math.ceil(measureText(el.name, { ...textFont(el.style, FONT.name), bold: true }) + TAB_PAD * 2));
}

/** Paquete UML: pestaña con el nombre y cuerpo que contiene a sus elementos. */
export const packageShape: ShapeDefinition<PackageElement> = {
  padding: (el) => ({ top: tabHeight(el) + 20, right: 20, bottom: 20, left: 20 }),
  measure: (el) => ({ width: Math.max(160, tabWidth(el) + 40), height: tabHeight(el) + 60 }),
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, { fill: COLORS.umlHeader, stroke: COLORS.stroke, text: COLORS.text });
    const tabH = tabHeight(el);
    const tab = Math.min(tabWidth(el), width);
    return [
      { type: 'rect', x: 0, y: 0, width: tab, height: tabH, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth },
      { type: 'rect', x: 0, y: tabH, width, height: height - tabH, fill: el.style?.fillColor ?? 'none', stroke: c.stroke, strokeWidth: c.strokeWidth },
      { type: 'text', x: TAB_PAD, y: tabH - 8, text: el.name, ...textFont(el.style, FONT.name), bold: true, color: c.text, anchor: 'start', slot: 'name' },
    ];
  },
};
