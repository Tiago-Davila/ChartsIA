import { isGroupKind } from '@chartsia/core/model';
import { type Edge, type Node, Panel } from '@xyflow/react';
import { EdgePanel } from '../edges/EdgeToolbar';
import { type RoutedEdgeData } from '../edges/RoutedEdge';
import { useDiagramEditActions } from '../nodes/edit-context';
import { type ElementNodeData } from '../nodes/types';
import { type StyleTarget } from './style-edits';
import { StylePanel } from './StylePanel';

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
        {element.kind === 'package' || element.kind === 'frame' ? 'Desagrupar' : 'Quitar límite'}
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

/** Objetivos del panel de estilo: los elementos y flechas seleccionados. */
function styleTargets(nodes: Node[], edges: Edge[]): StyleTarget[] {
  return [
    ...nodes
      .filter((n) => (n.data as ElementNodeData).element.kind !== 'drawing')
      .map((n) => {
        const { element } = n.data as ElementNodeData;
        return { id: element.id, relation: false, style: element.style };
      }),
    ...edges.map((e) => {
      const { relation } = e.data as RoutedEdgeData;
      return { id: relation.id, relation: true, style: relation.style };
    }),
  ];
}

/** Barra contextual arriba del lienzo con las acciones de lo seleccionado, y el panel de estilo. */
export function SelectionPanel({ nodes, edges, editingEdge, onEditEdge }: SelectionPanelProps) {
  const selectedEdges = edges.filter((e) => e.selected);
  const selectedNodes = nodes.filter((n) => n.selected);
  const { groupInFrame } = useDiagramEditActions();
  const onlyNode = selectedNodes.length === 1 && selectedEdges.length === 0 ? (selectedNodes[0]!.data as ElementNodeData).element : undefined;
  const onlyEdge = selectedEdges.length === 1 && selectedNodes.length === 0 ? selectedEdges[0]! : undefined;
  return (
    <>
      {selectedNodes.length > 1 ? (
        <Panel position="top-center" className="edge-toolbar nodrag nopan">
          <button type="button" className="button" onClick={() => groupInFrame(selectedNodes.map((node) => node.id))}>
            Agrupar en marco
          </button>
        </Panel>
      ) : null}
      {onlyNode && (isGroupKind(onlyNode.kind) || onlyNode.parentId) ? (
        <Panel position="top-center" className="edge-toolbar nodrag nopan">
          <GroupActions node={selectedNodes[0]!} />
        </Panel>
      ) : null}
      {onlyEdge ? (
        <Panel position="top-center" className="edge-toolbar nodrag nopan">
          <EdgePanel relation={(onlyEdge.data as RoutedEdgeData).relation} editingText={editingEdge === onlyEdge.id} onEditText={(open) => onEditEdge(open ? onlyEdge.id : undefined)} />
        </Panel>
      ) : null}
      <StylePanel targets={styleTargets(selectedNodes, selectedEdges)} />
    </>
  );
}
