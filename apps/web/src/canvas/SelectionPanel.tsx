import { type Edge, type Node, Panel } from '@xyflow/react';
import { EdgePanel } from '../edges/EdgeToolbar';
import { type RoutedEdgeData } from '../edges/RoutedEdge';

export interface SelectionPanelProps {
  nodes: Node[];
  edges: Edge[];
  editingEdge?: string;
  onEditEdge(edgeId: string | undefined): void;
}

/** Barra contextual arriba del lienzo con las acciones de lo seleccionado. */
export function SelectionPanel({ nodes, edges, editingEdge, onEditEdge }: SelectionPanelProps) {
  const selectedEdges = edges.filter((e) => e.selected);
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedEdges.length !== 1 || selectedNodes.length > 0) return null;
  const edge = selectedEdges[0]!;
  const relation = (edge.data as RoutedEdgeData).relation;
  return (
    <Panel position="top-center" className="edge-toolbar nodrag nopan">
      <EdgePanel relation={relation} editingText={editingEdge === edge.id} onEditText={(open) => onEditEdge(open ? edge.id : undefined)} />
    </Panel>
  );
}
