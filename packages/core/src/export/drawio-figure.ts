import { type Element } from '../model/diagram.js';
import { type FigureShape } from '../model/enums.js';
import { figureTextArea } from '../shapes/general/figure.js';
import { FONT } from '../shapes/types.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

const COMMON = 'whiteSpace=wrap;html=0;align=center;fontSize=14;fillColor=#fffef5;strokeColor=#1f2933;';
const r = (n: number) => Math.round(n * 100) / 100;

/** Forma nativa de draw.io para cada figura; el hexágono lleva su inclinación como fracción del ancho. */
function figureStyle(shape: FigureShape, geo: { width: number; height: number }): string {
  switch (shape) {
    case 'circle':
      return 'ellipse;aspect=fixed;';
    case 'square':
      return 'rounded=0;aspect=fixed;';
    case 'rectangle':
      return 'rounded=0;';
    case 'triangle': {
      // El texto va en la mitad inferior, como en el SVG: se baja con el margen superior y se estrecha con los laterales.
      const area = figureTextArea(shape, geo);
      return `triangle;direction=north;verticalAlign=middle;spacingTop=${r(area.y)};spacingLeft=${r(area.x)};spacingRight=${r(area.x)};`;
    }
    case 'hexagon':
      return `shape=hexagon;perimeter=hexagonPerimeter2;size=${Math.round((0.3 * geo.height / geo.width) * 100) / 100};`;
    case 'cloud':
      return 'ellipse;shape=cloud;';
  }
}

/** Figura general como la forma equivalente de draw.io, con el nombre como texto de la celda. */
export function figureCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'figure') return undefined;
  return [{ id: el.id, parent, value: el.name, vertex: true, geometry: geo, style: drawioFont(drawioBox(`${figureStyle(el.shape, geo)}${COMMON}`, el.style), el.style, FONT.name) }];
}

/**
 * Punto de conexión (fracción del ancho y del alto) tal como lo lee draw.io. El triángulo se dibuja
 * con `direction=north` y draw.io gira también sus puntos de conexión, así que se deshace ese giro.
 */
export function figureConstraint(el: Element | undefined, fx: number, fy: number): [number, number] {
  if (el?.kind === 'figure' && el.shape === 'triangle') return [r(1 - fy), fx];
  return [fx, fy];
}
