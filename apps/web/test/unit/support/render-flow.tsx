import { type Element, type Relation } from '@chartsia/core/model';
import { render } from '@testing-library/react';
import { Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { edgeTypes } from '../../../src/edges';
import { nodeTypes } from '../../../src/nodes';
import { DiagramEditContext, type DiagramEditActions } from '../../../src/nodes/edit-context';
import { measureElement } from '@chartsia/core/shapes';

/** Renderiza elementos y relaciones dentro de un React Flow real (jsdom). */
export function renderFlow(elements: Element[], relations: Relation[] = [], options: { selected?: string[]; actions?: DiagramEditActions } = {}) {
  const nodes = elements.map((element, i) => {
    const size = element.layout?.width ? { width: element.layout.width, height: element.layout.height! } : measureElement(element);
    return {
      id: element.id,
      type: element.kind,
      position: { x: element.layout?.x ?? i * 300, y: element.layout?.y ?? 0 },
      width: size.width,
      height: size.height,
      selected: (options.selected ?? []).includes(element.id),
      data: { element },
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
    data: { relation },
  }));
  const flow = (
    <div style={{ width: 1200, height: 800 }}>
      <ReactFlowProvider>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} />
      </ReactFlowProvider>
    </div>
  );
  return render(options.actions ? <DiagramEditContext.Provider value={options.actions}>{flow}</DiagramEditContext.Provider> : flow);
}
