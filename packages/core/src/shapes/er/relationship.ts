import { type Point } from '../../model/common.js';
import { type ElementOfKind } from '../../model/diagram.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText } from '../text-metrics.js';
import { COLORS, FONT, type Primitive, type ShapeDefinition } from '../types.js';

type RelationshipElement = ElementOfKind<'relationship'>;

/** Separación entre el borde exterior y el interior de una relación identificante. */
export const IDENTIFYING_GAP = 5;
const PAD_X = 12;
const PAD_Y = 8;
const MIN_WIDTH = 110;
const MIN_HEIGHT = 56;

/** Vértices de un rombo de `width` x `height` (en coordenadas locales), desplazados `gap` px hacia dentro. */
export function rhombusPoints(width: number, height: number, gap = 0): Point[] {
  const a = width / 2;
  const b = height / 2;
  const side = Math.hypot(a, b);
  // Desplazar cada lado `gap` px hacia dentro acerca cada semieje a su valor exacto.
  const dx = a - (gap * side) / b;
  const dy = b - (gap * side) / a;
  return [
    { x: a, y: b - dy },
    { x: a + dx, y: b },
    { x: a, y: b + dy },
    { x: a - dx, y: b },
  ];
}

/** Relación Chen: rombo con el nombre dentro; la identificante lleva un segundo borde interior. */
export const relationshipShape: ShapeDefinition<RelationshipElement> = {
  measure: (el) => {
    const font = textFont(el.style, FONT.name);
    // El texto debe caber en el rectángulo inscrito del rombo, que mide la mitad de cada lado.
    const extra = el.identifying ? IDENTIFYING_GAP * 2 : 0;
    const text = measureText(el.name, font) + PAD_X * 2;
    const height = lineHeight(font.size) + PAD_Y * 2;
    return { width: Math.max(MIN_WIDTH, Math.ceil(text * 2)) + extra, height: Math.max(MIN_HEIGHT, Math.ceil(height * 2)) + extra };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, { fill: COLORS.umlFill, stroke: COLORS.stroke, text: COLORS.text });
    const font = textFont(el.style, FONT.name);
    const outline = (points: Point[], fill: string): Primitive => ({
      type: 'path',
      d: `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`,
      fill,
      stroke: c.stroke,
      strokeWidth: c.strokeWidth,
    });
    return [
      outline(rhombusPoints(width, height), c.fill),
      ...(el.identifying ? [outline(rhombusPoints(width, height, IDENTIFYING_GAP), 'none')] : []),
      { type: 'text', x: width / 2, y: height / 2 + lineHeight(font.size) / 4, text: el.name, ...font, color: c.text, anchor: 'middle', slot: 'name' },
    ];
  },
};
