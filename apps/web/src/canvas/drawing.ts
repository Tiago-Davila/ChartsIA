import { DRAWING_MAX_POINTS, type Point } from '@chartsia/core/model';

/** Quita muestras cercanas y limita el trazo sin perder sus extremos. */
export function simplifyStroke(
  points: Point[],
  screenPoints: Point[],
  maxPoints = DRAWING_MAX_POINTS,
): Point[] {
  if (points.length !== screenPoints.length)
    throw new RangeError('Cada punto necesita su posición en pantalla.');
  if (points.length <= 2) return points;
  const spaced = [points[0]!];
  const spacedScreen = [screenPoints[0]!];
  let lastScreen = screenPoints[0]!;
  for (let i = 1; i < points.length - 1; i++) {
    const current = screenPoints[i]!;
    if (Math.hypot(current.x - lastScreen.x, current.y - lastScreen.y) < 2) continue;
    spaced.push(points[i]!);
    spacedScreen.push(current);
    lastScreen = current;
  }
  spaced.push(points[points.length - 1]!);
  spacedScreen.push(screenPoints[screenPoints.length - 1]!);
  if (spaced.length <= maxPoints) return spaced;
  return sampleStroke(spaced, spacedScreen, maxPoints).points;
}

/** Reduce ambos arreglos en paralelo y mantiene el primer y el último punto. */
export function sampleStroke(
  points: Point[],
  screenPoints: Point[],
  maxPoints: number,
): { points: Point[]; screenPoints: Point[] } {
  if (points.length !== screenPoints.length)
    throw new RangeError('Cada punto necesita su posición en pantalla.');
  if (maxPoints < 2) throw new RangeError('El trazo debe conservar al menos dos puntos.');
  if (points.length <= maxPoints) return { points, screenPoints };
  const indices = Array.from({ length: maxPoints }, (_, i) =>
    Math.round((i * (points.length - 1)) / (maxPoints - 1)),
  );
  return {
    points: indices.map((index) => points[index]!),
    screenPoints: indices.map((index) => screenPoints[index]!),
  };
}
