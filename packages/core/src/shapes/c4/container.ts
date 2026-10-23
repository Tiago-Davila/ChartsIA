import { type ElementOfKind } from '../../model/diagram.js';
import { type Primitive, type ShapeDefinition } from '../types.js';
import { paintOf } from '../style.js';
import { c4Colors } from './palette.js';
import { C4_MIN_HEIGHT, c4TextHeight, c4TextPrimitives, c4Width, type C4Text, typeLabel } from './text-block.js';

type ContainerElement = ElementOfKind<'container'>;

const CAP = 18; // alto de la tapa del cilindro (ry * 2)
const BAR = 24; // barra superior de la ventana web

function text(el: ContainerElement): C4Text {
  return { name: el.name, typeLabel: typeLabel('Container', el.technology), description: el.description, style: el.style };
}

function extra(el: ContainerElement): { w: number; h: number } {
  switch (el.variant) {
    case 'database':
      return { w: 0, h: CAP * 1.5 };
    case 'queue':
      return { w: CAP * 1.5, h: 0 };
    case 'web':
      return { w: 0, h: BAR };
    default:
      return { w: 0, h: 0 };
  }
}

/** Contenedor C4 con variantes: rectángulo, cilindro (BD), cilindro horizontal (cola), ventana (web). */
export const containerShape: ShapeDefinition<ContainerElement> = {
  measure: (el) => {
    const e = extra(el);
    const width = c4Width(text(el)) + e.w;
    const textHeight = c4TextHeight(text(el), width - e.w);
    return { width, height: Math.max(C4_MIN_HEIGHT, textHeight + 28) + e.h };
  },
  primitives: (el, { width: w, height: h }) => {
    const c = paintOf(el.style, c4Colors('container'));
    const paint = { fill: c.fill, stroke: c.stroke, strokeWidth: c.strokeWidth };
    const ry = CAP / 2;
    let body: Primitive[];
    let area = { x: 0, y: 0, width: w, height: h };
    switch (el.variant) {
      case 'database':
        body = [
          { type: 'path', d: `M 0 ${ry} L 0 ${h - ry} A ${w / 2} ${ry} 0 0 0 ${w} ${h - ry} L ${w} ${ry}`, ...paint },
          { type: 'ellipse', cx: w / 2, cy: ry, rx: w / 2, ry, ...paint },
        ];
        area = { x: 0, y: CAP, width: w, height: h - CAP - ry };
        break;
      case 'queue':
        body = [
          { type: 'path', d: `M ${ry} 0 L ${w - ry} 0 A ${ry} ${h / 2} 0 0 1 ${w - ry} ${h} L ${ry} ${h} A ${ry} ${h / 2} 0 0 1 ${ry} 0 Z`, ...paint },
          { type: 'ellipse', cx: w - ry, cy: h / 2, rx: ry, ry: h / 2, ...paint },
        ];
        area = { x: ry, y: 0, width: w - CAP * 1.5, height: h };
        break;
      case 'web':
        body = [
          { type: 'rect', x: 0, y: 0, width: w, height: h, rx: 6, ...paint },
          { type: 'line', x1: 0, y1: BAR, x2: w, y2: BAR, stroke: c.stroke, strokeWidth: c.strokeWidth },
          ...[0, 1, 2].map((i): Primitive => ({ type: 'ellipse', cx: 12 + i * 12, cy: BAR / 2, rx: 3.5, ry: 3.5, fill: '#ffffff', stroke: c.stroke })),
        ];
        area = { x: 0, y: BAR, width: w, height: h - BAR };
        break;
      default:
        body = [{ type: 'rect', x: 0, y: 0, width: w, height: h, rx: 6, ...paint }];
    }
    return [...body, ...c4TextPrimitives(text(el), area, c.text)];
  },
};
