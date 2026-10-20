import { type Element } from '@chartsia/core/model';
import { elementPrimitives, type Primitive, type Size } from '@chartsia/core/shapes';

const MAX_ENTRIES = 2000;
const cache = new Map<string, Primitive[]>();

/**
 * Primitivas de un elemento memoizadas por id, tamaño y contenido. Cada
 * actualización del hub trae objetos nuevos aunque un elemento no cambie; la clave por
 * contenido evita regenerar las formas de todo el diagrama.
 */
export function shapePrimitives(element: Element, size: Size): Primitive[] {
  const { layout: _layout, ...content } = element;
  const key = `${element.id}|${size.width}x${size.height}|${JSON.stringify(content)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const primitives = elementPrimitives(element, size);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, primitives);
  return primitives;
}
