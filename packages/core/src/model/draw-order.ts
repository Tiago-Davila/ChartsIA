import { isHighlighter } from './drawing-elements.js';
import { type Element } from './diagram.js';
import { isGroupKind } from './enums.js';

/** Profundidad de un elemento en la jerarquía de grupos (0 si no tiene padre). */
function depthOf(byId: Map<string, Element>, element: Element): number {
  let depth = 0;
  let parent = element.parentId ? byId.get(element.parentId) : undefined;
  while (parent && depth < 64) {
    depth++;
    parent = parent.parentId ? byId.get(parent.parentId) : undefined;
  }
  return depth;
}

/** Nivel de dibujo: solo se reordenan entre sí los elementos del mismo nivel. */
export function drawLevel(byId: Map<string, Element>, element: Element): string {
  if (isGroupKind(element.kind)) return `grupo:${depthOf(byId, element)}`;
  return isHighlighter(element) ? 'marcador' : 'figura';
}

/**
 * Orden de dibujo de fondo a frente: primero los grupos (por profundidad, para que un
 * contenedor quede detrás de sus hijos), luego los marcadores y después el resto. Dentro de
 * cada nivel manda el orden del array, que cambia `reorder_element`.
 */
export function drawOrder(elements: Element[]): Element[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const groups = elements.filter((e) => isGroupKind(e.kind)).sort((a, b) => depthOf(byId, a) - depthOf(byId, b));
  const markers = elements.filter((e) => !isGroupKind(e.kind) && isHighlighter(e));
  const figures = elements.filter((e) => !isGroupKind(e.kind) && !isHighlighter(e));
  return [...groups, ...markers, ...figures];
}
