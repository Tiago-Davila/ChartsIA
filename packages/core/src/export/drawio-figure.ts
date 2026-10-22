import { type Element } from '../model/diagram.js';
import { type FigureShape } from '../model/enums.js';
import { SLOPE } from '../shapes/general/figure.js';
import { FONT } from '../shapes/types.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

const COMMON = 'whiteSpace=wrap;html=0;align=center;fontSize=14;fillColor=#fffef5;strokeColor=#1f2933;';

/** Inclinación de los lados (hexágono y paralelogramo) como fracción del ancho, igual que el contorno del núcleo. */
function slant(geo: { width: number; height: number }): number {
  return Math.round((SLOPE * geo.height / geo.width) * 100) / 100;
}

/** Forma nativa de draw.io para cada figura; las formas inclinadas llevan su inclinación como fracción del ancho. */
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
      return `shape=hexagon;perimeter=hexagonPerimeter2;size=${slant(geo)};`;
    case 'parallelogram':
      return `shape=parallelogram;perimeter=parallelogramPerimeter;size=${slant(geo)};`;
    case 'diamond':
      return 'rhombus;';
    case 'oval':
      return 'ellipse;';
    case 'cloud':
      return 'ellipse;shape=cloud;';
  }
}

/** Figura general como la forma equivalente de draw.io, con el nombre como texto de la celda. */
export function figureCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'figure') return undefined;
  return [{ id: el.id, parent, value: el.name, vertex: true, geometry: geo, style: drawioFont(drawioBox(`${figureStyle(el.shape, geo)}${COMMON}`, el.style), el.style, FONT.name) }];
}
