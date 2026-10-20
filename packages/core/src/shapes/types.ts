import { type Element } from '../model/diagram.js';

export interface Size {
  width: number;
  height: number;
}

export interface Paint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Patrón de trazo discontinuo, p. ej. [6, 4]. */
  dash?: number[];
}

export type RectPrimitive = { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number } & Paint;
export type EllipsePrimitive = { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Paint;
export type PathPrimitive = { type: 'path'; d: string } & Paint;
export type LinePrimitive = { type: 'line'; x1: number; y1: number; x2: number; y2: number } & Paint;

/**
 * Texto con su línea base en `y`. `slot` identifica qué dato muestra (p. ej. `name`,
 * `attribute:0`) para que la app pueda editarlo en línea.
 */
export interface TextPrimitive {
  type: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  anchor: 'start' | 'middle' | 'end';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  slot?: string;
}

export type Primitive = RectPrimitive | EllipsePrimitive | PathPrimitive | LinePrimitive | TextPrimitive;

/**
 * Geometría declarativa de una forma. Las coordenadas de las primitivas son relativas a la
 * esquina superior izquierda del elemento. La misma definición la usan el exportador SVG y la
 * app, así lo que se ve y lo que se exporta coinciden.
 */
export interface ShapeDefinition<E extends Element = Element> {
  measure(element: E): Size;
  primitives(element: E, size: Size): Primitive[];
  /** Grupos: margen interior que deben respetar los hijos. */
  padding?: { top: number; right: number; bottom: number; left: number };
}

export const COLORS = {
  stroke: '#1f2933',
  text: '#1f2933',
  muted: '#52606d',
  fill: '#ffffff',
  umlFill: '#fffef5',
  umlHeader: '#fff6d6',
  edge: '#3e4c59',
} as const;

export const FONT = {
  name: 14,
  member: 13,
  small: 11,
  c4Name: 15,
  c4Type: 11,
  c4Description: 12,
} as const;
