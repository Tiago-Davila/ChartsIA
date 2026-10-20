import { type Diagram } from '../model/diagram.js';
import { type DiagramStyle, isGroupKind } from '../model/enums.js';
import { legendEntries, legendPrimitives } from '../shapes/c4/legend.js';
import { elementPrimitives } from '../shapes/registry.js';
import { type Primitive } from '../shapes/types.js';
import { edgePrimitives } from './edges.js';
import { hashSeed } from './hash.js';
import { sketchPrimitives } from './sketch.js';

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
  /** Grupos primero (de fuera hacia dentro) y luego elementos, para el orden de pintado. */
  nodes: SceneNode[];
  /** Absolutas. */
  edges: { id: string; primitives: Primitive[] }[];
  legend?: SceneNode;
}

export const FONT_FAMILIES: Record<DiagramStyle, string> = {
  clean: "Inter, 'Helvetica Neue', Arial, sans-serif",
  sketch: "Excalifont, 'Comic Sans MS', 'Segoe Print', cursive",
};

const MARGIN = 24;

function depth(diagram: Diagram, id: string): number {
  let d = 0;
  let el = diagram.elements.find((e) => e.id === id);
  while (el?.parentId && d < 64) {
    d++;
    const parentId: string = el.parentId;
    el = diagram.elements.find((e) => e.id === parentId);
  }
  return d;
}

/** Escena de render compartida por el SVG exportado y la app (estilos clean y sketch). */
export function buildScene(diagram: Diagram, style: DiagramStyle = diagram.style): Scene {
  const ordered = [...diagram.elements].sort(
    (a, b) =>
      Number(!isGroupKind(a.kind)) - Number(!isGroupKind(b.kind)) ||
      depth(diagram, a.id) - depth(diagram, b.id) ||
      (a.id < b.id ? -1 : 1),
  );
  const nodes: SceneNode[] = ordered.map((el) => {
    const l = el.layout ?? { x: 0, y: 0, width: 0, height: 0 };
    const width = l.width ?? 0;
    const height = l.height ?? 0;
    const base = elementPrimitives(el, { width, height });
    return { id: el.id, x: l.x, y: l.y, width, height, primitives: style === 'sketch' ? sketchPrimitives(base, hashSeed(el.id)) : base };
  });
  const edges = [...diagram.relations]
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((rel) => {
      const base = edgePrimitives(rel);
      return { id: rel.id, primitives: style === 'sketch' ? sketchPrimitives(base, hashSeed(rel.id)) : base };
    });

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
    legend = { id: '__legend__', x: maxX, y: minY + MARGIN, ...size, primitives: style === 'sketch' ? sketchPrimitives(primitives, 7) : primitives };
    maxX += size.width + MARGIN;
    maxY = Math.max(maxY, legend.y + size.height + MARGIN);
  }
  minX = Math.floor(minX);
  minY = Math.floor(minY);
  return { bounds: { x: minX, y: minY, width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) }, nodes, edges, legend };
}
