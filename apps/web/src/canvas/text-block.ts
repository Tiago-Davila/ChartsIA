import { type Diagram, type Element, type Point } from '@chartsia/core/model';
import { freeId } from './edge-edits';

/** Texto que trae un bloque nuevo; la edición lo selecciona entero para reemplazarlo al escribir. */
export const NEW_TEXT_BLOCK = 'Escribe aquí';

/** Bloque de texto nuevo con un id libre, en la posición indicada del lienzo. */
export function newTextBlock(diagram: Pick<Diagram, 'elements' | 'relations'>, point: Point): Element {
  return { id: freeId(diagram, 'Texto'), kind: 'text', name: NEW_TEXT_BLOCK, layout: { x: Math.round(point.x), y: Math.round(point.y) } };
}
