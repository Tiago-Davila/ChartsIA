import { CSS_FONT_FAMILIES, type Primitive } from '@chartsia/core/shapes';
import { memo, type MouseEvent } from 'react';

export interface PrimitivesProps {
  primitives: Primitive[];
  /** Doble clic sobre un texto con `slot` (edición en línea). */
  onTextDoubleClick?: (primitive: Extract<Primitive, { type: 'text' }>, event: MouseEvent<SVGTextElement>) => void;
}

const dash = (d?: number[]) => (d ? d.join(' ') : undefined);

/**
 * Primitivas del núcleo → JSX SVG. React escapa todo el texto: un nombre con HTML se ve
 * literal (FR-016, escenario 10 del quickstart).
 */
export const Primitives = memo(function Primitives({ primitives, onTextDoubleClick }: PrimitivesProps) {
  return (
    <>
      {primitives.map((p, i) => {
        switch (p.type) {
          case 'rect':
            return (
              <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} fill={p.fill ?? 'none'}
                stroke={p.stroke ?? 'none'} strokeWidth={p.strokeWidth} strokeDasharray={dash(p.dash)} />
            );
          case 'ellipse':
            return (
              <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill ?? 'none'} stroke={p.stroke ?? 'none'}
                strokeWidth={p.strokeWidth} strokeDasharray={dash(p.dash)} />
            );
          case 'line':
            return (
              <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke ?? 'none'} strokeWidth={p.strokeWidth}
                strokeDasharray={dash(p.dash)} />
            );
          case 'path':
            return (
              <path key={i} d={p.d} fill={p.fill ?? 'none'} stroke={p.stroke ?? 'none'} strokeWidth={p.strokeWidth}
                strokeDasharray={dash(p.dash)} />
            );
          case 'text':
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                fontSize={p.size}
                fontFamily={p.fontFamily ? CSS_FONT_FAMILIES[p.fontFamily] : undefined}
                fill={p.color}
                textAnchor={p.anchor === 'start' ? undefined : p.anchor}
                fontWeight={p.bold ? 'bold' : undefined}
                fontStyle={p.italic ? 'italic' : undefined}
                textDecoration={p.underline ? 'underline' : undefined}
                data-slot={p.slot}
                onDoubleClick={p.slot && onTextDoubleClick ? (e) => onTextDoubleClick(p, e) : undefined}
              >
                {p.text}
              </text>
            );
        }
      })}
    </>
  );
});
