import { type Diagram, drawOrder, isGroupKind, isHighlighter } from '@chartsia/core/model';
import { measureElement } from '@chartsia/core/shapes';
import { Position } from '@xyflow/react';
import { type RoutedFlowEdge } from '../edges';
import { type ElementFlowNode } from '../nodes';
import { frozenIds } from './locks';

/**
 * Modelo → nodos y aristas de React Flow. El tipo de nodo es el `kind`; los grupos son nodos
 * padre (sub-flows) y van antes que sus hijos, cuyas posiciones son relativas al padre.
 * Los handles se declaran en el nodo para que las aristas no dependan de medir el DOM.
 */
export function toReactFlow(diagram: Diagram): { nodes: ElementFlowNode[]; edges: RoutedFlowEdge[] } {
  const byId = new Map(diagram.elements.map((e) => [e.id, e]));
  const frozen = frozenIds(diagram);
  const nodes = drawOrder(diagram.elements).map((element): ElementFlowNode => {
    const size = element.layout?.width && element.layout.height ? { width: element.layout.width, height: element.layout.height } : measureElement(element);
    const parent = element.parentId ? byId.get(element.parentId) : undefined;
    const x = (element.layout?.x ?? 0) - (parent?.layout?.x ?? 0);
    const y = (element.layout?.y ?? 0) - (parent?.layout?.y ?? 0);
    return {
      id: element.id,
      type: element.kind,
      position: { x, y },
      width: size.width,
      height: size.height,
      ...(parent ? { parentId: parent.id } : {}),
      draggable: !frozen.has(element.id),
      deletable: !frozen.has(element.id),
      ...(isGroupKind(element.kind) || isHighlighter(element) ? { zIndex: -1 } : {}),
      data: { element },
      handles: [
        { type: 'target', position: Position.Top, x: size.width / 2, y: 0, width: 1, height: 1 },
        { type: 'source', position: Position.Bottom, x: size.width / 2, y: size.height, width: 1, height: 1 },
      ],
    };
  });
  const edges = diagram.relations
    .filter((r) => byId.has(r.source) && byId.has(r.target))
    .map((relation): RoutedFlowEdge => ({
      id: relation.id,
      source: relation.source,
      target: relation.target,
      type: 'routed',
      data: { relation },
    }));
  return { nodes, edges };
}
