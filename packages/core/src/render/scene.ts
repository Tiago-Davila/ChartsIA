import { type Diagram } from '../model/diagram.js';
import { drawOrder } from '../model/draw-order.js';
import { legendEntries, legendPrimitives } from '../shapes/c4/legend.js';
import { elementPrimitives } from '../shapes/registry.js';
import { type Primitive } from '../shapes/types.js';
import { edgePrimitives } from './edges.js';

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Relativas a (x, y). */
  primitives: Primitive[];
}

export interface Scene {
  bounds: { x: number; y: number; width: number; height: number };
  /** En orden de pintado: grupos, marcadores y luego el resto (ver `drawOrder`). */
  nodes: SceneNode[];
  /** Absolutas. */
  edges: { id: string; primitives: Primitive[] }[];
  legend?: SceneNode;
}

export const FONT_FAMILY = "Inter, 'Helvetica Neue', Arial, sans-serif";

const MARGIN = 24;

/** Escena de render compartida por el SVG exportado y la app. */
export function buildScene(diagram: Diagram): Scene {
  const nodes: SceneNode[] = drawOrder(diagram.elements).map((el) => {
    const l = el.layout ?? { x: 0, y: 0, width: 0, height: 0 };
    const width = l.width ?? 0;
    const height = l.height ?? 0;
    return { id: el.id, x: l.x, y: l.y, width, height, primitives: elementPrimitives(el, { width, height }) };
  });
  const edges = [...diagram.relations]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((rel) => ({ id: rel.id, primitives: edgePrimitives(rel) }));

  const xs: number[] = [];
  const ys: number[] = [];
  for (const node of nodes) {
    xs.push(node.x, node.x + node.width);
    ys.push(node.y, node.y + node.height);
  }
  for (const rel of diagram.relations) {
    for (const p of rel.route ?? []) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  if (xs.length === 0) {
    xs.push(0);
    ys.push(0);
  }
  let minX = Math.min(...xs) - MARGIN;
  let minY = Math.min(...ys) - MARGIN;
  let maxX = Math.max(...xs) + MARGIN;
  let maxY = Math.max(...ys) + MARGIN;

  let legend: SceneNode | undefined;
  const entries = legendEntries(diagram);
  if (entries.length > 0) {
    const { size, primitives } = legendPrimitives(entries);
    legend = { id: '__legend__', x: maxX, y: minY + MARGIN, ...size, primitives };
    maxX += size.width + MARGIN;
    maxY = Math.max(maxY, legend.y + size.height + MARGIN);
  }
  minX = Math.floor(minX);
  minY = Math.floor(minY);
  return { bounds: { x: minX, y: minY, width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) }, nodes, edges, legend };
}
