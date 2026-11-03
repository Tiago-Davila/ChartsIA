import { type Element } from '../model/diagram.js';
import { type Relation } from '../model/relation.js';
import { FLOW_EDGE_STYLES } from '../shapes/flow/edge.js';
import { flowBadge, flowNodeShape } from '../shapes/flow/node.js';
import { FLOW_PALETTE } from '../shapes/flow/palette.js';
import { lineHeight } from '../shapes/text-metrics.js';
import { type MarkerKind } from '../shapes/uml/markers.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';
import { flowIconDataUrl } from './flow-icon.js';

const r = (n: number) => Math.round(n * 100) / 100;

/** Punta de draw.io de un marcador de flujo, en el extremo `start` o `end`. */
function arrow(prefix: 'start' | 'end', marker: MarkerKind | undefined): string {
  if (marker === 'arrow-filled') return `${prefix}Arrow=block;${prefix}Fill=1;${prefix}Size=12;`;
  if (marker === 'arrow-open') return `${prefix}Arrow=open;${prefix}Size=12;`;
  return `${prefix}Arrow=none;`;
}

/** Estilo draw.io de una conexión de flujo: color, trazo y puntas según su tipo. */
export function flowEdgeStyle(rel: Relation): string {
  const style = FLOW_EDGE_STYLES[rel.flowType ?? 'call'];
  const dash = style.dash ? `dashed=1;dashPattern=${style.dash.join(' ')};` : '';
  return `flowType=${rel.flowType ?? 'call'};${arrow('start', style.start)}${arrow('end', style.end)}${dash}strokeColor=${style.color};fontColor=#404040;`;
}

/** Nodo de flujo con una celda por parte: tarjeta, recuadro, ícono como imagen SVG, título y subtítulo. */
export function flowNodeCells(
  el: Element,
  parent: string,
  geometry: { x: number; y: number; width: number; height: number },
): DrawioCell[] | undefined {
  if (el.kind !== 'flow-node') return undefined;
  const palette = FLOW_PALETTE[el.variant];
  const primitives = flowNodeShape.primitives(el, { width: geometry.width, height: geometry.height });
  const card = primitives[0];
  if (!card || card.type !== 'rect') return undefined;
  const badge = flowBadge(geometry.height);
  const object = { label: '', kind: 'flow-node', variant: el.variant, name: el.name, ...(el.subtitle ? { subtitle: el.subtitle } : {}) };
  const cells: DrawioCell[] = [
    {
      id: el.id,
      parent,
      vertex: true,
      geometry,
      object,
      style: drawioBox(`rounded=1;arcSize=${r(card.rx! * 2)};html=0;whiteSpace=wrap;fillColor=${card.fill};strokeColor=${card.stroke};strokeWidth=${card.strokeWidth};${card.dash ? 'dashed=1;' : ''}`, el.style),
    },
    {
      id: `${el.id}-badge`,
      parent: el.id,
      vertex: true,
      geometry: { x: badge.x, y: badge.y, width: badge.size, height: badge.size },
      style: `rounded=1;arcSize=22;html=0;fillColor=${palette.tint};strokeColor=none;`,
    },
    {
      id: `${el.id}-icon`,
      parent: el.id,
      vertex: true,
      geometry: { x: badge.icon.x, y: badge.icon.y, width: badge.icon.size, height: badge.icon.size },
      style: `shape=image;image=${flowIconDataUrl(el.variant, palette.accent).replace(';base64', '')};imageAspect=1;aspect=fixed;html=0;`,
    },
  ];
  primitives.forEach((primitive, i) => {
    if (primitive.type !== 'text') return;
    let style = `text;html=0;whiteSpace=wrap;overflow=hidden;align=left;verticalAlign=middle;spacing=0;fillColor=none;strokeColor=none;fontColor=${primitive.color};fontSize=${r(primitive.size)};`;
    if (primitive.bold) style += 'fontStyle=1;';
    style = drawioFont(style, el.style ? { fontFamily: el.style.fontFamily } : undefined, primitive.size);
    cells.push({
      id: `${el.id}-text-${i}`,
      parent: el.id,
      value: primitive.text,
      vertex: true,
      style,
      geometry: { x: r(primitive.x), y: r(primitive.y - primitive.size * 0.875), width: r(Math.max(0, geometry.width - primitive.x)), height: lineHeight(primitive.size) },
    });
  });
  return cells;
}
