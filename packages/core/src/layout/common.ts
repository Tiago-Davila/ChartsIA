import { type Point } from '../model/common.js';
import { type Diagram } from '../model/diagram.js';
import { FLOW_RELATION_KIND, isGroupKind } from '../model/enums.js';
import { type Relation } from '../model/relation.js';
import { measureElement } from '../shapes/registry.js';
import { type Size } from '../shapes/types.js';
import { routeEdges } from './router.js';
import { type PositionMap } from './types.js';

/** Tamaño de cada elemento: el de su contenido, o el elegido a mano si es mayor. */
export function measureAll(diagram: Diagram): Map<string, Size> {
  return new Map(
    diagram.elements.map((el) => {
      const size = measureElement(el, diagram.preferences?.uml);
      const l = el.layout;
      if (!l?.resized) return [el.id, size];
      return [el.id, { width: Math.max(size.width, l.width ?? 0), height: Math.max(size.height, l.height ?? 0) }];
    }),
  );
}

/** Una conexión de flujo sale por el puerto derecho del origen y entra por el izquierdo del destino, ambos al centro del lado. */
function routeRequest(rel: Relation) {
  if (rel.kind !== FLOW_RELATION_KIND) return rel;
  return { ...rel, sourceSide: rel.sourceSide ?? ('right' as const), targetSide: rel.targetSide ?? ('left' as const), centered: true };
}

/** Escribe layouts y rutas en una copia del diagrama, con elementos y relaciones en orden. */
export function withGeometry(diagram: Diagram, layouts: PositionMap): Diagram {
  const rects = new Map([...layouts].map(([id, l]) => [id, { x: l.x, y: l.y, width: l.width, height: l.height }]));
  const leaves = diagram.elements.filter((e) => !isGroupKind(e.kind) && e.kind !== 'drawing').map((e) => e.id);
  const ovals = new Set(diagram.elements.filter((e) => e.kind === 'attribute').map((e) => e.id));
  const routes = routeEdges(diagram.relations.map(routeRequest), rects, leaves, ovals);
  return {
    ...diagram,
    elements: diagram.elements.map((el) => ({ ...el, layout: { ...layouts.get(el.id)!, ...(el.layout?.resized ? { resized: true } : {}) } })),
    relations: diagram.relations.map((rel) => ({ ...rel, route: routes.get(rel.id) ?? ([] as Point[]) })),
  };
}
