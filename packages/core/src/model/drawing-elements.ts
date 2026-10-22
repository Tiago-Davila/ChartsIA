import { z } from 'zod';
import { elementBaseShape, LayoutSchema } from './common.js';
import { HEX_COLOR_PATTERN } from './style.js';

export const DRAWING_MAX_POINTS = 1024;
export const DRAWING_MAX_COORDINATE = 5000;
export const DRAWING_MIN_STROKE_WIDTH = 0.5;
export const DRAWING_MAX_STROKE_WIDTH = 16;
export const DRAWING_DEFAULT_COLOR = '#1f2933';
export const DRAWING_DEFAULT_WIDTH = 2.5;
/** Grosor en px de cada opción del lápiz; "medium" es el grosor por defecto. */
export const DRAWING_WIDTH_PX = { thin: 1.5, medium: DRAWING_DEFAULT_WIDTH, thick: 5 } as const;

export const DrawingPointSchema = z.strictObject({
  x: z.number().finite().min(0).max(DRAWING_MAX_COORDINATE),
  y: z.number().finite().min(0).max(DRAWING_MAX_COORDINATE),
});

export const DrawingPointsSchema = z.array(DrawingPointSchema).min(2).max(DRAWING_MAX_POINTS);

/** Trazo libre en coordenadas relativas a su esquina superior izquierda. */
export const DrawingElementSchema = z.strictObject({
  ...elementBaseShape,
  layout: LayoutSchema.optional(),
  kind: z.literal('drawing'),
  points: DrawingPointsSchema,
  strokeColor: z.string().regex(HEX_COLOR_PATTERN),
  strokeWidth: z.number().finite().min(DRAWING_MIN_STROKE_WIDTH).max(DRAWING_MAX_STROKE_WIDTH),
});
