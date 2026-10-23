import { type Element } from '../model/diagram.js';
import { imageDataUrlForDrawio } from '../model/image-data.js';
import { type DrawioCell } from './drawio.js';

/** Imagen embebida como `data:` en una celda draw.io; no acepta URLs externas. */
export function imageCells(el: Element, parent: string, geometry: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'image') return undefined;
  return [{
    id: el.id,
    parent,
    geometry,
    style: `shape=image;image=${imageDataUrlForDrawio(el.src)};imageAspect=1;aspect=fixed;html=0;`,
  }];
}
