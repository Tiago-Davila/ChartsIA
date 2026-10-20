import type { Diagram, Element, Layout, Point } from '../../src/model/index.js';
import { isGroupKind } from '../../src/model/index.js';

export type Rect = { x: number; y: number; width: number; height: number };

export function layoutOf(d: Diagram, id: string): Layout {
  const el = d.elements.find((e) => e.id === id);
  if (!el?.layout) throw new Error(`sin layout: ${id}`);
  return el.layout as Layout;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function ancestors(d: Diagram, id: string): Set<string> {
  const out = new Set<string>();
  let el: Element | undefined = d.elements.find((e) => e.id === id);
  while (el?.parentId && !out.has(el.parentId)) {
    out.add(el.parentId);
    el = d.elements.find((e) => e.id === el!.parentId);
  }
  return out;
}

/** Pares de elementos hermanos (mismo padre) cuyos rectángulos se solapan. */
export function overlappingPairs(d: Diagram): [string, string][] {
  const pairs: [string, string][] = [];
  for (const a of d.elements) {
    for (const b of d.elements) {
      if (a.id >= b.id || a.parentId !== b.parentId) continue;
      if (overlaps(layoutOf(d, a.id), layoutOf(d, b.id))) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

function segmentHitsRect(p: Point, q: Point, r: Rect): boolean {
  // Las rutas son ortogonales: basta comparar el segmento con el interior del rectángulo.
  const minX = Math.min(p.x, q.x);
  const maxX = Math.max(p.x, q.x);
  const minY = Math.min(p.y, q.y);
  const maxY = Math.max(p.y, q.y);
  return minX < r.x + r.width && maxX > r.x && minY < r.y + r.height && maxY > r.y;
}

/** Aristas que atraviesan un nodo hoja distinto de su origen y destino. */
export function edgesCrossingNodes(d: Diagram): [string, string][] {
  const hits: [string, string][] = [];
  for (const rel of d.relations) {
    const route = rel.route ?? [];
    for (const el of d.elements) {
      if (el.id === rel.source || el.id === rel.target || isGroupKind(el.kind)) continue;
      const r = layoutOf(d, el.id);
      for (let i = 0; i + 1 < route.length; i++) {
        if (segmentHitsRect(route[i]!, route[i + 1]!, r)) {
          hits.push([rel.id, el.id]);
          break;
        }
      }
    }
  }
  return hits;
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
