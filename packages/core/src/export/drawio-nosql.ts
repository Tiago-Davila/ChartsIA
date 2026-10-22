import { type Element } from '../model/diagram.js';
import { collectionShape } from '../shapes/nosql/collection.js';
import { lineHeight } from '../shapes/text-metrics.js';
import { type Primitive, type RectPrimitive, type TextPrimitive } from '../shapes/types.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

const r = (n: number) => Math.round(n * 100) / 100;

function rectStyle(rect: RectPrimitive, collection: Extract<Element, { kind: 'collection' }>, outer = false): string {
  const roundness = rect.rx ? `rounded=1;arcSize=${r(rect.rx * 2)};` : 'rounded=0;';
  const base = `${roundness}html=0;whiteSpace=wrap;fillColor=${rect.fill ?? 'none'};strokeColor=${rect.stroke ?? 'none'};strokeWidth=${rect.strokeWidth ?? 1};`;
  return outer ? drawioBox(base, collection.style) : base;
}

function textCell(
  collection: Extract<Element, { kind: 'collection' }>,
  text: TextPrimitive,
  index: number,
  parent: string,
  width: number,
): DrawioCell {
  const height = lineHeight(text.size);
  let style = `text;html=0;whiteSpace=wrap;overflow=hidden;align=left;verticalAlign=middle;spacing=0;spacingLeft=0;spacingRight=0;spacingTop=0;spacingBottom=0;fillColor=none;strokeColor=${text.color};fontSize=${r(text.size)};`;
  if (text.bold) style += 'fontStyle=1;';
  style = drawioFont(style, collection.style ? { fontFamily: collection.style.fontFamily } : undefined, text.size);
  return {
    id: `${collection.id}-nosql-${index}`,
    parent,
    value: text.text,
    vertex: true,
    style,
    geometry: { x: r(text.x), y: r(text.y - text.size * 0.875), width: r(Math.max(0, width - text.x)), height },
  };
}

/** Colección con una celda por caja/texto: draw.io conserva el mismo anidamiento que la app y el SVG. */
export function collectionCells(
  el: Element,
  parent: string,
  geometry: { x: number; y: number; width: number; height: number },
): DrawioCell[] | undefined {
  if (el.kind !== 'collection') return undefined;
  const primitives = collectionShape.primitives(el, { width: geometry.width, height: geometry.height });
  const outer = primitives[0];
  if (!outer || outer.type !== 'rect') return undefined;
  const cells: DrawioCell[] = [{
    id: el.id,
    parent,
    vertex: true,
    geometry,
    object: { label: '', kind: 'collection', name: el.name, fields: JSON.stringify(el.fields) },
    style: rectStyle(outer, el, true),
  }];
  primitives.slice(1).forEach((primitive: Primitive, i) => {
    const index = i + 1;
    if (primitive.type === 'rect') {
      cells.push({
        id: `${el.id}-nosql-${index}`,
        parent: el.id,
        vertex: true,
        style: rectStyle(primitive, el),
        geometry: { x: r(primitive.x), y: r(primitive.y), width: r(primitive.width), height: r(primitive.height) },
      });
    } else if (primitive.type === 'text') {
      cells.push(textCell(el, primitive, index, el.id, geometry.width));
    }
  });
  return cells;
}
