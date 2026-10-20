import { type Diagram } from '../model/diagram.js';
import { arrange } from './arrange.js';
import { measureAll, withGeometry } from './common.js';
import { buildElkGraph, runElk } from './elk-graph.js';
import { type Rect } from './types.js';

/** Elemento ya colocado en el diagrama anterior (tiene tamaño calculado por el servidor). */
function placed(el: Diagram['elements'][number]): boolean {
  return el.layout !== undefined && el.layout.width !== undefined && el.layout.height !== undefined;
}

/**
 * Layout incremental (FR-020, research R7): los existentes conservan su posición, los
 * fijados nunca se mueven y los nuevos se colocan con ELK en modo interactivo sembrado con
 * las posiciones previas, trasladados al marco del diagrama anterior según sus vecinos.
 */
export async function relayoutDiagram(previous: Diagram, next: Diagram): Promise<{ diagram: Diagram; warnings: string[] }> {
  const sizes = measureAll(next);
  const prevById = new Map(previous.elements.map((e) => [e.id, e]));
  const existing = new Set(next.elements.filter((e) => placed(e) && prevById.has(e.id)).map((e) => e.id));
  const pinned = new Set(next.elements.filter((e) => e.layout?.pinned).map((e) => e.id));

  const positions = new Map<string, Rect>();
  for (const el of next.elements) {
    if (!el.layout) continue;
    const size = sizes.get(el.id)!;
    positions.set(el.id, { x: el.layout.x, y: el.layout.y, width: size.width, height: size.height });
  }

  const fresh = next.elements.filter((e) => !positions.has(e.id));
  if (fresh.length > 0) {
    const elk = await runElk(buildElkGraph({ diagram: next, sizes, seeds: positions }));
    const freshIds = new Set(fresh.map((e) => e.id));
    const parentOf = new Map(next.elements.map((e) => [e.id, e.parentId]));
    const rootOf = (id: string): string => {
      const parent = parentOf.get(id);
      return parent && freshIds.has(parent) ? rootOf(parent) : id;
    };
    const subtree = new Map<string, string[]>();
    for (const el of fresh) {
      const root = rootOf(el.id);
      subtree.set(root, [...(subtree.get(root) ?? []), el.id]);
    }
    const neighbors = (ids: Set<string>) => {
      const out = new Set<string>();
      for (const rel of next.relations) {
        if (ids.has(rel.source) && positions.has(rel.target)) out.add(rel.target);
        if (ids.has(rel.target) && positions.has(rel.source)) out.add(rel.source);
      }
      for (const id of ids) {
        const parent = parentOf.get(id);
        if (parent && positions.has(parent)) out.add(parent);
      }
      return [...out].sort();
    };
    const offset = (refs: string[]) => {
      const valid = refs.filter((id) => elk.has(id));
      if (valid.length === 0) return undefined;
      const dx = valid.reduce((s, id) => s + positions.get(id)!.x - elk.get(id)!.x, 0) / valid.length;
      const dy = valid.reduce((s, id) => s + positions.get(id)!.y - elk.get(id)!.y, 0) / valid.length;
      return { dx, dy };
    };
    const globalOffset = offset([...positions.keys()].sort());
    const right = Math.max(0, ...[...positions.values()].map((r) => r.x + r.width));

    for (const [root, ids] of [...subtree].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const shift =
        offset(neighbors(new Set(ids))) ?? (globalOffset ? { dx: Math.max(globalOffset.dx, right + 80 - elk.get(root)!.x), dy: globalOffset.dy } : { dx: 0, dy: 0 });
      for (const id of ids) {
        const r = elk.get(id)!;
        positions.set(id, { x: r.x + shift.dx, y: r.y + shift.dy, width: sizes.get(id)!.width, height: sizes.get(id)!.height });
      }
    }
  }

  const isNew = new Set(next.elements.filter((e) => !existing.has(e.id)).map((e) => e.id));
  const { layouts, warnings } = arrange({ diagram: next, positions, sizes, pinned, isNew });
  return { diagram: withGeometry(next, layouts), warnings };
}
