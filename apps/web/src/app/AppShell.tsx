import { type ExportFormat } from '@chartsia/core/export';
import { type Diagram, type DiagramStyle } from '@chartsia/core/model';
import { type Edge, type Node } from '@xyflow/react';
import { type ReactNode } from 'react';
import { DiagramCanvas, type DiagramCanvasProps } from '../canvas/DiagramCanvas';
import { C4Legend } from '../legend/C4Legend';
import { ConnectionStatus, type ConnectionState } from './ConnectionStatus';
import { DiagramList, type DiagramListItem } from './DiagramList';
import { EmptyState } from './EmptyState';
import { Toolbar } from './Toolbar';

export interface AppShellProps {
  diagrams: DiagramListItem[];
  activeDiagramId: string | null;
  connection: ConnectionState;
  diagram?: Diagram;
  nodes: Node[];
  edges: Edge[];
  origin: string;
  readOnly?: boolean;
  onOpen(diagramId: string): void;
  onStyleChange(style: DiagramStyle): void;
  onExport(format: ExportFormat): void;
  onNodeDragStop?: DiagramCanvasProps['onNodeDragStop'];
  onDelete?: DiagramCanvasProps['onDelete'];
  /** Avisos superpuestos (errores de validación, etc.). */
  overlay?: ReactNode;
}

/** Composición de la app: barra lateral, toolbar, lienzo, leyenda y estado vacío. */
export function AppShell(props: AppShellProps) {
  const { diagram } = props;
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>◆</span> ChartsIA
        </div>
        <DiagramList diagrams={props.diagrams} activeDiagramId={props.activeDiagramId} openDiagramId={diagram?.id ?? null} onOpen={props.onOpen} />
        <ConnectionStatus state={props.connection} />
      </aside>
      <main className="app-shell__main">
        {diagram ? (
          <>
            <Toolbar
              title={diagram.title}
              style={diagram.style}
              revision={diagram.revision}
              disabled={props.readOnly}
              onStyleChange={props.onStyleChange}
              onExport={props.onExport}
            />
            <div className={`app-shell__canvas style-${diagram.style}`}>
              <DiagramCanvas
                diagramId={diagram.id}
                nodes={props.nodes}
                edges={props.edges}
                readOnly={props.readOnly}
                onNodeDragStop={props.onNodeDragStop}
                onDelete={props.onDelete}
              />
              <C4Legend diagram={diagram} />
            </div>
          </>
        ) : (
          <EmptyState origin={props.origin} />
        )}
        {props.overlay}
      </main>
    </div>
  );
}
