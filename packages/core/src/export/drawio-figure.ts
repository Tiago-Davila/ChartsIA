import { type Element } from '../model/diagram.js';
import { type FigureShape } from '../model/enums.js';
import { type DrawioCell } from './drawio.js';

const COMMON = 'whiteSpace=wrap;html=0;align=center;fontSize=14;fillColor=#fffef5;strokeColor=#1f2933;';

/** Forma nativa de draw.io para cada figura; el hexágono lleva su inclinación como fracción del ancho. */
function figureStyle(shape: FigureShape, geo: { width: number; height: number }): string {
  switch (shape) {
    case 'circle':
      return 'ellipse;aspect=fixed;';
    case 'square':
      return 'rounded=0;aspect=fixed;';
    case 'rectangle':
      return 'rounded=0;';
    case 'triangle':
      return 'triangle;direction=north;verticalAlign=bottom;';
    case 'hexagon':
      return `shape=hexagon;perimeter=hexagonPerimeter2;size=${Math.round((0.3 * geo.height / geo.width) * 100) / 100};`;
    case 'cloud':
      return 'ellipse;shape=cloud;';
  }
}

/** Figura general como la forma equivalente de draw.io, con el nombre como texto de la celda. */
export function figureCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'figure') return undefined;
  return [{ id: el.id, parent, value: el.name, vertex: true, geometry: geo, style: `${figureStyle(el.shape, geo)}${COMMON}` }];
}
