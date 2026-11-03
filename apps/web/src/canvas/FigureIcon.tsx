import { elementPrimitives, flowBadge, measureElement } from '@chartsia/core/shapes';
import { memo } from 'react';
import { Primitives } from '../render/Primitives';
import { type PaletteItem } from './figure-palette';

/** Margen alrededor de la figura para que el trazo no se corte en el borde. */
const MARGEN = 4;

/** Ícono de una figura de la barra: la misma geometría del núcleo que se dibuja en el lienzo, sin textos y escalada al botón. */
export const FigureIcon = memo(function FigureIcon({ item }: { item: PaletteItem }) {
  const element = item.build('icono', '');
  const size = measureElement(element);
  // Un nodo de flujo es una tarjeta ancha: su ícono muestra solo el recuadro con el símbolo de la variante.
  const badge = element.kind === 'flow-node' ? flowBadge(size.height) : undefined;
  const primitives = elementPrimitives(element, size).filter((p, i) => p.type !== 'text' && !(badge && i === 0));
  const view = badge ? { x: badge.x, y: badge.y, width: badge.size, height: badge.size } : { x: 0, y: 0, ...size };
  return (
    <svg className="figure-icon" viewBox={`${view.x - MARGEN} ${view.y - MARGEN} ${view.width + 2 * MARGEN} ${view.height + 2 * MARGEN}`} aria-hidden="true" focusable="false">
      <Primitives primitives={primitives} />
    </svg>
  );
});
