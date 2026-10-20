import { type DiagramStyle, type Element } from '@chartsia/core/model';
import { hashSeed, sketchPrimitives } from '@chartsia/core/render';
import { elementPrimitives, type Primitive, type Size } from '@chartsia/core/shapes';

const MAX_ENTRIES = 2000;
const cache = new Map<string, Primitive[]>();

/**
 * Primitivas de un elemento memoizadas por estilo, id, tamaño y contenido. Cada
 * actualización del hub trae objetos nuevos aunque un elemento no cambie; la clave por
 * contenido evita regenerar el boceto (roughjs) de todo el diagrama.
 */
export function shapePrimitives(element: Element, size: Size, style: DiagramStyle): Primitive[] {
  const { layout: _layout, ...content } = element;
  const key = `${style}|${element.id}|${size.width}x${size.height}|${JSON.stringify(content)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const base = elementPrimitives(element, size);
  const primitives = style === 'sketch' ? sketchPrimitives(base, hashSeed(element.id)) : base;
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, primitives);
  return primitives;
}
