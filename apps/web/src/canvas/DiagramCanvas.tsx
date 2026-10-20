import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnNodeDrag,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useEffect } from 'react';
import { edgeTypes } from '../edges';
import { nodeTypes } from '../nodes';

export interface DiagramCanvasProps {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onNodeDragStop?: OnNodeDrag;
  onDelete?: (params: { nodes: Node[]; edges: Edge[] }) => void;
}

const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1.25 };
const PRO_OPTIONS = { hideAttribution: true };
const MINIMAP_STYLE = { width: 180, height: 120 };

function nodeColor(node: Node): string {
  const kind = node.type ?? '';
  if (kind === 'person') return '#08427b';
  if (kind === 'software-system') return '#1168bd';
  if (kind === 'container') return '#438dd5';
  if (kind === 'component') return '#85bbf0';
  if (kind === 'package' || kind === 'boundary') return 'transparent';
  return '#f6e7a6';
}

/**
 * Lienzo infinito (React Flow): pan, zoom, minimapa y controles. El estado local permite
 * arrastrar con fluidez; cada actualización del hub lo reemplaza (el hub es la fuente de verdad).
 */
export function DiagramCanvas({ diagramId, nodes: incomingNodes, edges: incomingEdges, readOnly = false, onNodeDragStop, onDelete }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(incomingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(incomingEdges);
  const { fitView } = useReactFlow();

  useEffect(() => setNodes(incomingNodes), [incomingNodes, setNodes]);
  useEffect(() => setEdges(incomingEdges), [incomingEdges, setEdges]);
  // Al abrir otro diagrama se encuadra completo.
  useEffect(() => {
    const frame = requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    return () => cancelAnimationFrame(frame);
  }, [diagramId, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onNodeDragStop}
      onDelete={onDelete}
      nodesDraggable={!readOnly}
      nodesConnectable={false}
      elementsSelectable
      deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      minZoom={0.05}
      maxZoom={4}
      onlyRenderVisibleElements
      proOptions={PRO_OPTIONS}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d5d9e0" />
      <MiniMap pannable zoomable nodeColor={nodeColor} nodeStrokeColor="#9aa5b1" style={MINIMAP_STYLE} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
