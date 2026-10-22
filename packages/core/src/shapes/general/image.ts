import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';

type ImageElement = ElementOfKind<'image'>;

/** Imagen embebida con un lienzo inicial que se puede redimensionar desde la app. */
export const imageShape: ShapeDefinition<ImageElement> = {
  measure: () => ({ width: 320, height: 220 }),
  primitives: (element, size) => [{ type: 'image', href: element.src, x: 0, y: 0, width: size.width, height: size.height }],
};
