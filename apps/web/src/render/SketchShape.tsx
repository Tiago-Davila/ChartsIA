import { Primitives } from './Primitives';
import { FONT_SKETCH, type ShapeProps } from './CleanShape';
import { shapePrimitives } from './shape-cache';

/** Estilo boceto: trazos de roughjs con semilla por id (como Excalidraw) y Excalifont. */
export function SketchShape({ element, size, onTextDoubleClick }: ShapeProps) {
  return (
    <svg data-testid={`shape-${element.id}`} width={size.width} height={size.height} overflow="visible" fontFamily={FONT_SKETCH}>
      <Primitives primitives={shapePrimitives(element, size, 'sketch')} onTextDoubleClick={onTextDoubleClick} />
    </svg>
  );
}
