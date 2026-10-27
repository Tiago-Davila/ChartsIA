import { elementPrimitives, measureElement } from '@chartsia/core/shapes';
import { memo } from 'react';
import { Primitives } from '../render/Primitives';
import { type PaletteItem } from './figure-palette';

/** Margen alrededor de la figura para que el trazo no se corte en el borde. */
const MARGEN = 4;

/** Ícono de una figura de la barra: la misma geometría del núcleo que se dibuja en el lienzo, sin textos y escalada al botón. */
export const FigureIcon = memo(function FigureIcon({ item }: { item: PaletteItem }) {
  const element = item.build('icono', '');
  const size = measureElement(element);
  const primitives = elementPrimitives(element, size).filter((p) => p.type !== 'text');
  return (
    <svg className="figure-icon" viewBox={`${-MARGEN} ${-MARGEN} ${size.width + 2 * MARGEN} ${size.height + 2 * MARGEN}`} aria-hidden="true" focusable="false">
      <Primitives primitives={primitives} />
    </svg>
  );
});
