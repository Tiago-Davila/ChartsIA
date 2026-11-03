import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText, wrapText } from '../text-metrics.js';
import { COLORS, FONT, type Primitive, type ShapeDefinition } from '../types.js';
import { flowIconPrimitives } from './icons.js';
import { FLOW_PALETTE } from './palette.js';

type FlowNodeElement = ElementOfKind<'flow-node'>;

const PAD = 12;
const BADGE = 36;
const ICON = 20;
const TEXT_X = PAD + BADGE + PAD;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;
const MIN_HEIGHT = 56;
const MAX_LINES = 2;
const DASH = [6, 4];

/** Recuadro del ícono y el ícono dentro de él, en coordenadas de la tarjeta. */
export function flowBadge(height: number) {
  const y = (height - BADGE) / 2;
  return { x: PAD, y, size: BADGE, icon: { x: PAD + (BADGE - ICON) / 2, y: y + (BADGE - ICON) / 2, size: ICON } };
}

function fonts(el: FlowNodeElement) {
  return { title: { ...textFont(el.style, FONT.name), bold: true }, subtitle: textFont(el.style, FONT.small) };
}

/** Ancho de la tarjeta: el del texto más largo entre el mínimo y el máximo. */
function nodeWidth(el: FlowNodeElement): number {
  const font = fonts(el);
  const text = Math.max(measureText(el.name, font.title), el.subtitle ? measureText(el.subtitle, font.subtitle) : 0);
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.ceil(TEXT_X + text + PAD)));
}

/** Líneas del título y del subtítulo, partidas para que quepan a la derecha del ícono. */
function textLines(el: FlowNodeElement, width: number) {
  const font = fonts(el);
  const inner = width - TEXT_X - PAD;
  return {
    title: wrapText(el.name, inner, font.title, MAX_LINES),
    subtitle: el.subtitle ? wrapText(el.subtitle, inner, font.subtitle, MAX_LINES) : [],
  };
}

/** Nodo de flujo: tarjeta redondeada con el ícono de su variante a la izquierda, el título y el subtítulo. */
export const flowNodeShape: ShapeDefinition<FlowNodeElement> = {
  measure: (el) => {
    const width = nodeWidth(el);
    const lines = textLines(el, width);
    const font = fonts(el);
    const text = lines.title.length * lineHeight(font.title.size) + lines.subtitle.length * lineHeight(font.subtitle.size);
    return { width, height: Math.max(MIN_HEIGHT, text + PAD * 2) };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, { fill: '#ffffff', stroke: '#cbd5e1', text: COLORS.text });
    const palette = FLOW_PALETTE[el.variant];
    const font = fonts(el);
    const lines = textLines(el, width);
    const titleHeight = lineHeight(font.title.size);
    const subtitleHeight = lineHeight(font.subtitle.size);
    let y = (height - lines.title.length * titleHeight - lines.subtitle.length * subtitleHeight) / 2;
    const badge = flowBadge(height);
    const out: Primitive[] = [
      { type: 'rect', x: 0, y: 0, width, height, rx: 10, fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth, ...(el.variant === 'external' ? { dash: DASH } : {}) },
      { type: 'rect', x: badge.x, y: badge.y, width: badge.size, height: badge.size, rx: 8, fill: palette.tint, stroke: 'none' },
      ...flowIconPrimitives(el.variant, palette.accent, badge.icon.x, badge.icon.y, badge.icon.size),
    ];
    lines.title.forEach((line, i) => {
      out.push({ type: 'text', x: TEXT_X, y: y + titleHeight * 0.75, text: line, ...font.title, color: c.text, anchor: 'start', ...(i === 0 ? { slot: 'name' } : {}) });
      y += titleHeight;
    });
    lines.subtitle.forEach((line, i) => {
      out.push({ type: 'text', x: TEXT_X, y: y + subtitleHeight * 0.75, text: line, ...font.subtitle, color: COLORS.muted, anchor: 'start', ...(i === 0 ? { slot: 'subtitle' } : {}) });
      y += subtitleHeight;
    });
    return out;
  },
};
