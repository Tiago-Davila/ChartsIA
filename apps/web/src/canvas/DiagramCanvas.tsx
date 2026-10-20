import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnConnect,
  type OnNodeDrag,
  ReactFlow,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { edgeTypes } from '../edges';
import { nodeTypes } from '../nodes';
import { SelectionPanel } from './SelectionPanel';

export interface DiagramCanvasProps {
  diagramId: string;
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onNodeDragStop?: OnNodeDrag;
  onDelete?: (params: { nodes: Node[]; edges: Edge[] }) => void;
  onConnect?: OnConnect;
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

/** Copia el estado `selected` de los elementos que siguen existiendo. */
function keepSelection<T extends Node | Edge>(prev: T[], next: T[]): T[] {
  const selected = new Set(prev.filter((item) => item.selected).map((item) => item.id));
  return selected.size === 0 ? next : next.map((item) => (selected.has(item.id) ? { ...item, selected: true } : item));
}

/**
 * Lienzo infinito (React Flow): pan, zoom, minimapa y controles. El estado local permite
 * arrastrar con fluidez; cada actualización del hub lo reemplaza (el hub es la fuente de verdad).
 */
export function DiagramCanvas({ diagramId, nodes: incomingNodes, edges: incomingEdges, readOnly = false, onNodeDragStop, onDelete, onConnect }: DiagramCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(incomingNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(incomingEdges);
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const fittedFor = useRef<string | null>(null);
  const [editingEdge, setEditingEdge] = useState<string>();
  // Cierra el formulario de textos cuando la flecha deja de estar seleccionada.
  const onSelectionChange = useCallback(({ edges: selected }: { edges: Edge[] }) => {
    setEditingEdge((id) => (selected.some((e) => e.id === id) ? id : undefined));
  }, []);

  // Cada actualización del hub reemplaza nodos y aristas, pero conserva lo seleccionado.
  useEffect(() => setNodes((prev) => keepSelection(prev, incomingNodes)), [incomingNodes, setNodes]);
  useEffect(() => setEdges((prev) => keepSelection(prev, incomingEdges)), [incomingEdges, setEdges]);
  // Al abrir otro diagrama se encuadra completo, cuando React Flow ya midió sus nodos.
  useEffect(() => {
    if (!initialized || fittedFor.current === diagramId) return;
    fittedFor.current = diagramId;
    void fitView(FIT_VIEW_OPTIONS);
  }, [initialized, diagramId, fitView]);

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
      onConnect={onConnect}
      onEdgeDoubleClick={(_, edge) => !readOnly && setEditingEdge(edge.id)}
      onSelectionChange={onSelectionChange}
      nodesConnectable={!readOnly}
      connectionMode={ConnectionMode.Loose}
      elementsSelectable
      deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
      minZoom={0.05}
      maxZoom={4}
      proOptions={PRO_OPTIONS}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d5d9e0" />
      <MiniMap pannable zoomable nodeColor={nodeColor} nodeStrokeColor="#9aa5b1" style={MINIMAP_STYLE} />
      <Controls showInteractive={false} />
      {readOnly ? null : <SelectionPanel nodes={nodes} edges={edges} editingEdge={editingEdge} onEditEdge={setEditingEdge} />}
    </ReactFlow>
  );
}
