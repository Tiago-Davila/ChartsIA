import { type Point } from '../../model/common.js';
import { type ElementOfKind } from '../../model/diagram.js';
import { type FigureShape } from '../../model/enums.js';
import { type Style } from '../../model/style.js';
import { paintOf, textFont } from '../style.js';
import { lineHeight, measureText, wrapText } from '../text-metrics.js';
import { COLORS, FONT, type Primitive, type ShapeDefinition, type Size } from '../types.js';

type FigureElement = ElementOfKind<'figure'>;
type Area = { x: number; y: number; width: number; height: number };

const MARGIN = 16;
const MAX_LINES = 4;
/** Inclinación de los lados del hexágono y del paralelogramo, relativa a su alto. */
export const SLOPE = 0.3;
/** Alto del triángulo equilátero relativo a su ancho. */
const EQUILATERAL_RATIO = Math.sqrt(3) / 2;
/** Alto de los triángulos escaleno y rectángulo relativo a su ancho. */
const SKEWED_RATIO = 0.8;
/** Vértice superior de cada triángulo, como fracción de su ancho; el triángulo rectángulo lo tiene en la esquina. */
const APEX: Partial<Record<FigureShape, number>> = {
  triangle: 0.5,
  'isosceles-triangle': 0.5,
  'equilateral-triangle': 0.5,
  'scalene-triangle': 0.3,
  'right-triangle': 0,
};
const r = (n: number) => Math.round(n * 100) / 100;

/** Zona del texto de un triángulo: su mitad inferior, desde `left` y con `span` del ancho. */
const lowerHalf = (left: number, span: number) => ({ width, height }: Size): Area =>
  ({ x: width * left, y: height / 2, width: width * span, height: height / 2 });

/** Tamaño de ancho dado con el alto que fija la proporción `ratio`. */
const proportional = (width: number, ratio: number): Size => ({ width, height: Math.ceil(width * ratio) });

/** Cada forma indica a qué ancho se parte el texto, su tamaño mínimo, cuánto mide para un texto y dónde queda el texto. */
interface FigureGeometry {
  wrap: number;
  min: Size;
  size(text: Size): Size;
  area(size: Size): Area;
}

const box = (size: Size): Area => ({ x: MARGIN / 2, y: MARGIN / 2, width: size.width - MARGIN, height: size.height - MARGIN });

/** Área de texto de la elipse: un rectángulo centrado de 0,7 de cada eje, dentro de su contorno. */
const ELLIPSE_AREA = ({ width, height }: Size): Area => ({ x: width * 0.15, y: height * 0.15, width: width * 0.7, height: height * 0.7 });

/** Forma de lados inclinados (hexágono y paralelogramo). */
const SLANTED: FigureGeometry = {
  wrap: 120,
  min: { width: 120, height: 64 },
  size: (t) => {
    const height = Math.max(64, t.height + 8);
    return { width: Math.ceil(t.width + SLOPE * 2 * height), height };
  },
  area: ({ width, height }) => ({ x: SLOPE * height, y: MARGIN / 2, width: width - SLOPE * 2 * height, height: height - MARGIN }),
};

// El texto va en la mitad inferior, donde el triángulo mide al menos la mitad de su base.
const ISOSCELES: FigureGeometry = {
  wrap: 110,
  min: { width: 120, height: 104 },
  size: (t) => ({ width: t.width * 2, height: t.height * 2 }),
  area: lowerHalf(0.25, 0.5),
};

const GEOMETRY: Record<FigureShape, FigureGeometry> = {
  rectangle: {
    wrap: 160,
    min: { width: 120, height: 60 },
    size: (t) => ({ width: t.width, height: t.height + 8 }),
    area: box,
  },
  square: {
    wrap: 140,
    min: { width: 100, height: 100 },
    size: (t) => ({ width: Math.max(t.width, t.height), height: Math.max(t.width, t.height) }),
    area: box,
  },
  // El texto ocupa un cuadrado centrado de 0,7 del diámetro, que cabe dentro del círculo.
  circle: {
    wrap: 100,
    min: { width: 100, height: 100 },
    size: (t) => ({ width: Math.ceil(Math.max(t.width, t.height) / 0.7), height: Math.ceil(Math.max(t.width, t.height) / 0.7) }),
    area: ELLIPSE_AREA,
  },
  // El texto ocupa el centro de la elipse, dentro de 0,7 de cada eje.
  oval: {
    wrap: 120,
    min: { width: 120, height: 64 },
    size: (t) => ({ width: Math.ceil(t.width / 0.7), height: Math.ceil(t.height / 0.7) }),
    area: ELLIPSE_AREA,
  },
  // El texto ocupa el centro del rombo, donde cabe la mitad de su ancho y de su alto.
  diamond: {
    wrap: 110,
    min: { width: 120, height: 80 },
    size: (t) => ({ width: t.width * 2, height: t.height * 2 }),
    area: ({ width, height }) => ({ x: width / 4, y: height / 4, width: width / 2, height: height / 2 }),
  },
  // `triangle` es el isósceles de antes; se mantiene para los diagramas que ya lo usan.
  triangle: ISOSCELES,
  'isosceles-triangle': ISOSCELES,
  // Alto fijo de 0,87 del ancho; el texto cabe en su mitad inferior.
  'equilateral-triangle': {
    wrap: 110,
    min: { width: 120, height: 104 },
    size: (t) => proportional(Math.ceil(Math.max(t.width * 2, (t.height * 2) / EQUILATERAL_RATIO)), EQUILATERAL_RATIO),
    area: lowerHalf(0.25, 0.5),
  },
  // El vértice está desplazado a 0,3 del ancho; el texto cabe entre sus dos lados en la mitad inferior.
  'scalene-triangle': {
    wrap: 110,
    min: { width: 120, height: 96 },
    size: (t) => proportional(Math.ceil(Math.max(t.width * 2, t.height * 2.5)), SKEWED_RATIO),
    area: lowerHalf(0.15, 0.5),
  },
  // El ángulo recto va abajo a la izquierda; el texto cabe bajo la hipotenusa.
  'right-triangle': {
    wrap: 110,
    min: { width: 120, height: 96 },
    size: (t) => proportional(Math.ceil(2.5 * Math.max(t.width, t.height)), SKEWED_RATIO),
    area: lowerHalf(0.05, 0.4),
  },
  // El texto ocupa el ancho de la cara superior e inferior, que siempre queda dentro del hexágono.
  hexagon: SLANTED,
  // Sus lados inclinados dejan el mismo hueco que el hexágono, así que el texto cabe en ambos.
  parallelogram: SLANTED,
  // El texto ocupa el centro de la nube, lejos de sus lóbulos.
  cloud: {
    wrap: 110,
    min: { width: 140, height: 90 },
    size: (t) => ({ width: Math.ceil(t.width / 0.6), height: Math.ceil(t.height / 0.45) }),
    area: ({ width, height }) => ({ x: width * 0.2, y: height * 0.25, width: width * 0.6, height: height * 0.45 }),
  },
};

/** Vértices de las figuras poligonales (triángulos, rombo, paralelogramo y hexágono); el resto no tiene. */
export function figureOutline(shape: FigureShape, { width, height }: Size): Point[] | undefined {
  const apex = APEX[shape];
  if (apex !== undefined) return [{ x: width * apex, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
  if (shape === 'diamond') return [{ x: width / 2, y: 0 }, { x: width, y: height / 2 }, { x: width / 2, y: height }, { x: 0, y: height / 2 }];
  const inset = SLOPE * height;
  if (shape === 'parallelogram') return [{ x: inset, y: 0 }, { x: width, y: 0 }, { x: width - inset, y: height }, { x: 0, y: height }];
  if (shape !== 'hexagon') return undefined;
  return [
    { x: inset, y: 0 },
    { x: width - inset, y: 0 },
    { x: width, y: height / 2 },
    { x: width - inset, y: height },
    { x: inset, y: height },
    { x: 0, y: height / 2 },
  ];
}

/** Zona donde se centra el texto de la figura, relativa a su esquina superior izquierda. */
export function figureTextArea(shape: FigureShape, size: Size): Area {
  return GEOMETRY[shape].area(size);
}

/** Contorno de la nube (la misma curva que la forma `cloud` de draw.io), escalado al tamaño dado. */
function cloudPath({ width: w, height: h }: Size): string {
  const p = (x: number, y: number) => `${r(x * w)} ${r(y * h)}`;
  return [
    `M ${p(0.25, 0.25)}`,
    `C ${p(0.05, 0.25)} ${p(0, 0.5)} ${p(0.16, 0.55)}`,
    `C ${p(0, 0.66)} ${p(0.18, 0.9)} ${p(0.31, 0.8)}`,
    `C ${p(0.4, 1)} ${p(0.7, 1)} ${p(0.8, 0.8)}`,
    `C ${p(1, 0.8)} ${p(1, 0.6)} ${p(0.875, 0.5)}`,
    `C ${p(1, 0.3)} ${p(0.8, 0.1)} ${p(0.625, 0.2)}`,
    `C ${p(0.5, 0.05)} ${p(0.3, 0.05)} ${p(0.25, 0.25)}`,
    'Z',
  ].join(' ');
}

function outlinePrimitive(shape: FigureShape, size: Size, paint: { fill: string; stroke: string; strokeWidth: number }): Primitive {
  const look = paint;
  const { width, height } = size;
  const points = figureOutline(shape, size);
  if (points) return { type: 'path', d: `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`).join(' ')} Z`, ...look };
  if (shape === 'circle' || shape === 'oval') return { type: 'ellipse', cx: width / 2, cy: height / 2, rx: width / 2, ry: height / 2, ...look };
  if (shape === 'cloud') return { type: 'path', d: cloudPath(size), ...look };
  return { type: 'rect', x: 0, y: 0, width, height, ...look };
}

function textLines(name: string, width: number, style?: Style): string[] {
  return wrapText(name, width, textFont(style, FONT.name), MAX_LINES);
}

/**
 * Figura general: círculo, óvalo, cuadrado, rectángulo, triángulo (cuatro variantes), rombo, paralelogramo, hexágono o nube con el nombre
 * centrado dentro. El tamaño natural encierra el texto partido en líneas.
 */
export const figureShape: ShapeDefinition<FigureElement> = {
  measure: (el) => {
    const geometry = GEOMETRY[el.shape];
    const font = textFont(el.style, FONT.name);
    const lines = textLines(el.name, geometry.wrap, el.style);
    const text = {
      width: Math.max(...lines.map((l) => measureText(l, font))) + MARGIN,
      height: lines.length * lineHeight(font.size) + MARGIN,
    };
    const size = geometry.size(text);
    return { width: Math.ceil(Math.max(geometry.min.width, size.width)), height: Math.ceil(Math.max(geometry.min.height, size.height)) };
  },
  primitives: (el, size) => {
    const area = figureTextArea(el.shape, size);
    const c = paintOf(el.style, { fill: COLORS.umlFill, stroke: COLORS.stroke, text: COLORS.text });
    const font = textFont(el.style, FONT.name);
    const lines = textLines(el.name, area.width, el.style);
    const lh = lineHeight(font.size);
    const top = area.y + (area.height - lines.length * lh) / 2;
    return [
      outlinePrimitive(el.shape, size, c),
      ...lines.map((text, i): Primitive => ({
        type: 'text', x: area.x + area.width / 2, y: top + i * lh + lh * 0.75, text, ...font, color: c.text, anchor: 'middle',
        ...(i === 0 ? { slot: 'name' } : {}),
      })),
    ];
  },
};
