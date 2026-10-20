import { type Element } from '@chartsia/core/model';
import { type Size } from '@chartsia/core/shapes';
import { type PrimitivesProps, Primitives } from './Primitives';
import { shapePrimitives } from './shape-cache';

export interface ShapeProps extends Pick<PrimitivesProps, 'onTextDoubleClick'> {
  element: Element;
  size: Size;
}

export const FONT_SKETCH = "Excalifont, 'Comic Sans MS', cursive";

/** Estilo limpio: la misma geometría que el SVG exportado (formas de draw.io). */
export function CleanShape({ element, size, onTextDoubleClick }: ShapeProps) {
  return (
    <svg data-testid={`shape-${element.id}`} width={size.width} height={size.height} overflow="visible" fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif">
      <Primitives primitives={shapePrimitives(element, size, 'clean')} onTextDoubleClick={onTextDoubleClick} />
    </svg>
  );
}
