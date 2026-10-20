import { type DiagramStyle, type Relation } from '@chartsia/core/model';
import { edgePrimitives, hashSeed, sketchPrimitives } from '@chartsia/core/render';
import { relationStyle } from '@chartsia/core/shapes';
import { type Edge, type EdgeProps } from '@xyflow/react';
import { memo, useMemo } from 'react';
import { Primitives } from '../render/Primitives';
import { EdgeMarkers } from './markers';

export type RoutedEdgeData = { relation: Relation; style: DiagramStyle };
export type RoutedFlowEdge = Edge<RoutedEdgeData>;

/**
 * Arista que dibuja la ruta ortogonal calculada por el hub (puntos de `route`), con
 * marcadores, etiqueta y multiplicidades. Sin ruta, une los extremos en línea recta.
 */
function RoutedEdgeImpl({ id, data, sourceX, sourceY, targetX, targetY, selected }: EdgeProps<RoutedFlowEdge>) {
  const relation = data!.relation;
  const style = data!.style;
  const routed = (relation.route?.length ?? 0) >= 2;
  const primitives = useMemo(() => {
    if (!routed) return [];
    const base = edgePrimitives(relation);
    return style === 'sketch' ? sketchPrimitives(base, hashSeed(relation.id)) : base;
  }, [relation, style, routed]);

  const points = routed ? relation.route! : [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }];
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const look = relationStyle(relation);

  return (
    <g data-testid={`edge-${id}`} className={`chartsia-edge${selected ? ' is-selected' : ''}`}>
      {routed ? (
        <Primitives primitives={primitives} />
      ) : (
        <>
          <path d={d} fill="none" stroke={look.color} strokeWidth={1.5} strokeDasharray={look.dash?.join(' ')} />
          <EdgeMarkers relation={relation} points={points} />
        </>
      )}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} className="react-flow__edge-interaction" />
    </g>
  );
}

export const RoutedEdge = memo(RoutedEdgeImpl);
