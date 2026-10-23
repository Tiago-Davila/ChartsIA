import { type Diagram } from '../model/diagram.js';
import { arrange } from './arrange.js';
import { measureAll, withGeometry } from './common.js';
import { buildElkGraph, runElk } from './elk-graph.js';
import { type Rect } from './types.js';

/**
 * Layout completo (creación). ELK coloca todos los elementos; los que traen coordenadas
 * del agente quedan fijados en ellas y el resto se separa para no solaparse con ellos.
 */
export async function layoutDiagram(diagram: Diagram): Promise<Diagram> {
  const sizes = measureAll(diagram);
  const elk = await runElk(buildElkGraph({ diagram, sizes }));
  const positions = new Map<string, Rect>();
  const pinned = new Set<string>();
  for (const el of diagram.elements) {
    const r = elk.get(el.id)!;
    // En creación, cualquier coordenada recibida viene del agente: queda fijada.
    if (el.layout) {
      pinned.add(el.id);
      positions.set(el.id, { ...r, x: el.layout.x, y: el.layout.y });
    } else positions.set(el.id, r);
  }
  for (const el of diagram.elements) if (el.locked) pinned.add(el.id);
  // Un grupo fijado arrastra a sus hijos colocados por ELK.
  for (const el of diagram.elements) {
    if (!pinned.has(el.id)) continue;
    const dx = positions.get(el.id)!.x - elk.get(el.id)!.x;
    const dy = positions.get(el.id)!.y - elk.get(el.id)!.y;
    if (!dx && !dy) continue;
    const stack = diagram.elements.filter((c) => c.parentId === el.id);
    while (stack.length > 0) {
      const child = stack.pop()!;
      if (!pinned.has(child.id)) {
        const r = positions.get(child.id)!;
        positions.set(child.id, { ...r, x: r.x + dx, y: r.y + dy });
      }
      stack.push(...diagram.elements.filter((c) => c.parentId === child.id));
    }
  }
  const locked = new Set(diagram.elements.filter((e) => e.locked).map((e) => e.id));
  const { layouts } = arrange({ diagram, positions, sizes, pinned, locked });
  return withGeometry(diagram, layouts);
}

/** Ejecuta un layout mínimo para cargar y compilar ELK antes de la primera petición real. */
export async function warmUpLayout(): Promise<void> {
  await layoutDiagram({
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title: 'warm-up',
    revision: 0,
    createdAt: '',
    updatedAt: '',
    elements: [
      { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] },
      { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
    ],
    relations: [{ id: 'r', kind: 'association', source: 'A', target: 'B' }],
  });
}
