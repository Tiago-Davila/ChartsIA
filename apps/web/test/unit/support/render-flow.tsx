import { type Element, type Relation } from '@chartsia/core/model';
import { render } from '@testing-library/react';
import { Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { edgeTypes } from '../../../src/edges';
import { nodeTypes } from '../../../src/nodes';
import { measureElement } from '@chartsia/core/shapes';
import { type DiagramStyle } from '@chartsia/core/model';

/** Renderiza elementos y relaciones dentro de un React Flow real (jsdom). */
export function renderFlow(elements: Element[], relations: Relation[] = [], style: DiagramStyle = 'clean') {
  const nodes = elements.map((element, i) => {
    const size = element.layout?.width ? { width: element.layout.width, height: element.layout.height! } : measureElement(element);
    return {
      id: element.id,
      type: element.kind,
      position: { x: element.layout?.x ?? i * 300, y: element.layout?.y ?? 0 },
      width: size.width,
      height: size.height,
      data: { element, style },
      handles: [
        { type: 'target' as const, position: Position.Top, x: size.width / 2, y: 0, width: 1, height: 1 },
        { type: 'source' as const, position: Position.Bottom, x: size.width / 2, y: size.height, width: 1, height: 1 },
      ],
    };
  });
  const edges = relations.map((relation) => ({
    id: relation.id,
    source: relation.source,
    target: relation.target,
    type: 'routed',
    data: { relation, style },
  }));
  return render(
    <div style={{ width: 1200, height: 800 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </ReactFlowProvider>
    </div>,
  );
}
