import { type Point } from '@chartsia/core/model';
import { markerPrimitives, relationStyle } from '@chartsia/core/shapes';
import { type Relation } from '@chartsia/core/model';
import { Primitives } from '../render/Primitives';

/**
 * Marcadores UML/C4 de una relación (triángulo, rombo, flecha), con la misma geometría que
 * el SVG exportado. Útil para dibujar una relación sin ruta calculada (p. ej. al arrastrar).
 */
export function EdgeMarkers({ relation, points }: { relation: Pick<Relation, 'kind' | 'navigable' | 'arrowheads' | 'dashed'>; points: Point[] }) {
  if (points.length < 2) return null;
  const style = relationStyle(relation);
  const n = points.length;
  return (
    <Primitives
      primitives={[
        ...(style.start ? markerPrimitives(style.start, points[0]!, points[1]!, style.color) : []),
        ...(style.end ? markerPrimitives(style.end, points[n - 1]!, points[n - 2]!, style.color) : []),
      ]}
    />
  );
}
