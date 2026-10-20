import { type Point } from '../model/common.js';
import { type Diagram } from '../model/diagram.js';
import { isGroupKind } from '../model/enums.js';
import { measureElement } from '../shapes/registry.js';
import { type Size } from '../shapes/types.js';
import { routeEdges } from './router.js';
import { type PositionMap } from './types.js';

export function measureAll(diagram: Diagram): Map<string, Size> {
  return new Map(diagram.elements.map((el) => [el.id, measureElement(el)]));
}

/** Escribe layouts y rutas en una copia del diagrama, con elementos y relaciones en orden. */
export function withGeometry(diagram: Diagram, layouts: PositionMap): Diagram {
  const rects = new Map([...layouts].map(([id, l]) => [id, { x: l.x, y: l.y, width: l.width, height: l.height }]));
  const leaves = diagram.elements.filter((e) => !isGroupKind(e.kind)).map((e) => e.id);
  const routes = routeEdges(diagram.relations, rects, leaves);
  return {
    ...diagram,
    elements: diagram.elements.map((el) => ({ ...el, layout: layouts.get(el.id)! })),
    relations: diagram.relations.map((rel) => ({ ...rel, route: routes.get(rel.id) ?? ([] as Point[]) })),
  };
}
