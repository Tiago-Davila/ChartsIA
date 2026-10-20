import { isGroupKind } from '@chartsia/core/model';
import { type Edge, type Node, Panel } from '@xyflow/react';
import { EdgePanel } from '../edges/EdgeToolbar';
import { type RoutedEdgeData } from '../edges/RoutedEdge';
import { useDiagramEditActions } from '../nodes/edit-context';
import { type ElementNodeData } from '../nodes/types';

export interface SelectionPanelProps {
  nodes: Node[];
  edges: Edge[];
  editingEdge?: string;
  onEditEdge(edgeId: string | undefined): void;
}

/** Acciones de un elemento dentro de un grupo, o de un grupo. */
function GroupActions({ node }: { node: Node }) {
  const { leaveGroup, ungroup } = useDiagramEditActions();
  const { element } = node.data as ElementNodeData;
  if (isGroupKind(element.kind)) {
    return (
      <button type="button" className="button" onClick={() => ungroup(element.id)}>
        {element.kind === 'package' ? 'Desagrupar' : 'Quitar límite'}
      </button>
    );
  }
  if (!element.parentId) return null;
  return (
    <button type="button" className="button" onClick={() => leaveGroup(element.id)}>
      Sacar del grupo
    </button>
  );
}

/** Barra contextual arriba del lienzo con las acciones de lo seleccionado. */
export function SelectionPanel({ nodes, edges, editingEdge, onEditEdge }: SelectionPanelProps) {
  const selectedEdges = edges.filter((e) => e.selected);
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length === 1 && selectedEdges.length === 0) {
    const { element } = selectedNodes[0]!.data as ElementNodeData;
    if (!isGroupKind(element.kind) && !element.parentId) return null;
    return (
      <Panel position="top-center" className="edge-toolbar nodrag nopan">
        <GroupActions node={selectedNodes[0]!} />
      </Panel>
    );
  }
  if (selectedEdges.length !== 1 || selectedNodes.length > 0) return null;
  const edge = selectedEdges[0]!;
  const relation = (edge.data as RoutedEdgeData).relation;
  return (
    <Panel position="top-center" className="edge-toolbar nodrag nopan">
      <EdgePanel relation={relation} editingText={editingEdge === edge.id} onEditText={(open) => onEditEdge(open ? edge.id : undefined)} />
    </Panel>
  );
}
