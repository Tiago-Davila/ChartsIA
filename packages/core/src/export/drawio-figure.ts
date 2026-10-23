import { type Element } from '../model/diagram.js';
import { type FigureShape } from '../model/enums.js';
import { ARROWS, figureTextArea, SLOPE } from '../shapes/general/figure.js';
import { FONT } from '../shapes/types.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

const COMMON = 'whiteSpace=wrap;html=0;align=center;fontSize=14;fillColor=#fffef5;strokeColor=#1f2933;';
const r = (n: number) => Math.round(n * 100) / 100;

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
    case 'isosceles-triangle':
    case 'equilateral-triangle': {
      // El texto va en la mitad inferior, como en el SVG: se baja con el margen superior y se estrecha con los laterales.
      const area = figureTextArea(shape, geo);
      return `triangle;direction=north;verticalAlign=middle;spacingTop=${r(area.y)};spacingLeft=${r(area.x)};spacingRight=${r(area.x)};`;
    }
    case 'scalene-triangle':
      return 'shape=mxgraph.basic.acute_triangle;dx=30;verticalAlign=bottom;';
    case 'right-triangle':
      return 'shape=mxgraph.basic.right_triangle;verticalAlign=bottom;';
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
    case 'pentagon':
      return 'shape=mxgraph.basic.pentagon;';
    // draw.io no trae heptágono, así que se aproxima con una elipse.
    case 'heptagon':
      return 'ellipse;aspect=fixed;';
    // El corte de cada esquina es 0,29 del lado, lo que deja un octágono regular.
    case 'octagon':
      return `shape=mxgraph.basic.octagon2;dx=${Math.round(0.29 * Math.min(geo.width, geo.height))};`;
    // Las flechas de bloque de draw.io llevan el grosor del tramo como fracción de la caja.
    case 'arrow':
      return `shape=singleArrow;direction=east;arrowWidth=${ARROWS.arrow!.shaft};`;
    case 'double-arrow':
      return `shape=doubleArrow;arrowWidth=${ARROWS['double-arrow']!.shaft};`;
    case 'arrow-right':
      return `shape=singleArrow;direction=east;arrowWidth=${ARROWS['arrow-right']!.shaft};`;
    case 'arrow-left':
      return `shape=singleArrow;direction=west;arrowWidth=${ARROWS['arrow-left']!.shaft};`;
    case 'arrow-up':
      return `shape=singleArrow;direction=north;arrowWidth=${ARROWS['arrow-up']!.shaft};`;
    case 'arrow-down':
      return `shape=singleArrow;direction=south;arrowWidth=${ARROWS['arrow-down']!.shaft};`;
  }
}

/** Figura general como la forma equivalente de draw.io, con el nombre como texto de la celda. */
export function figureCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'figure') return undefined;
  return [{ id: el.id, parent, value: el.name, vertex: true, geometry: geo, style: drawioFont(drawioBox(`${figureStyle(el.shape, geo)}${COMMON}`, el.style), el.style, FONT.name) }];
}

// Triángulos que draw.io dibuja con `direction=north`, que también gira sus puertos.
const NORTH_TRIANGLES = new Set<string>(['triangle', 'isosceles-triangle', 'equilateral-triangle']);

/**
 * Punto de conexión (fracción del ancho y del alto) tal como lo lee draw.io. El triángulo se dibuja
 * con `direction=north` y draw.io gira también sus puntos de conexión, así que se deshace ese giro.
 */
export function figureConstraint(el: Element | undefined, fx: number, fy: number): [number, number] {
  if (el?.kind === 'figure' && NORTH_TRIANGLES.has(el.shape)) return [r(1 - fy), fx];
  return [fx, fy];
}
