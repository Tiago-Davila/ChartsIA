import { type ExportFormat } from '@chartsia/core/export';
import { type Diagram } from '@chartsia/core/model';
import { type Edge, type Node } from '@xyflow/react';
import { type ReactNode } from 'react';
import { type Project } from '../state/api-client';
import { type AlignMode } from '../canvas/align';
import { DiagramCanvas, type DiagramCanvasProps } from '../canvas/DiagramCanvas';
import { C4Legend } from '../legend/C4Legend';
import { ConnectionStatus, type ConnectionState } from './ConnectionStatus';
import { DiagramList, type DiagramListItem } from './DiagramList';
import { EmptyState } from './EmptyState';
import { Toolbar } from './Toolbar';

export interface AppShellProps {
  diagrams: DiagramListItem[];
  projects: Project[];
  activeDiagramId: string | null;
  connection: ConnectionState;
  diagram?: Diagram;
  /** Hay un diagrama abierto que aún se está cargando. */
  loading?: boolean;
  nodes: Node[];
  edges: Edge[];
  origin: string;
  readOnly?: boolean;
  onOpen(diagramId: string): void;
  onMoveDiagram(diagramId: string, projectId: string | null): void;
  onNewProject(diagramId: string, name: string): void;
  onExport(format: ExportFormat): void;
  onRename?(title: string): void;
  onNodeDragStop?: DiagramCanvasProps['onNodeDragStop'];
  onDelete?: DiagramCanvasProps['onDelete'];
  onConnect?: DiagramCanvasProps['onConnect'];
  onAlign?(mode: AlignMode): void;
  changedIds?: string[];
  onOpenLatest?(): Promise<boolean>;
  onChangedFitted?(): void;
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
        <DiagramList diagrams={props.diagrams} projects={props.projects} activeDiagramId={props.activeDiagramId} openDiagramId={diagram?.id ?? null} onOpen={props.onOpen} onMove={props.onMoveDiagram} onNewProject={props.onNewProject} />
        <ConnectionStatus state={props.connection} />
      </aside>
      <main className="app-shell__main">
        {diagram ? (
          <>
            <Toolbar
              title={diagram.title}
              revision={diagram.revision}
              disabled={props.readOnly}
              onExport={props.onExport}
              onRename={props.onRename}
              onAlign={props.readOnly ? undefined : props.onAlign}
              changedIds={props.changedIds}
              onOpenLatest={props.onOpenLatest}
              onChangedFitted={props.onChangedFitted}
            />
            <div className="app-shell__canvas">
              <DiagramCanvas
                diagramId={diagram.id}
                nodes={props.nodes}
                edges={props.edges}
                readOnly={props.readOnly}
                onNodeDragStop={props.onNodeDragStop}
                onDelete={props.onDelete}
                onConnect={props.onConnect}
              />
              <C4Legend diagram={diagram} />
            </div>
          </>
        ) : props.loading ? (
          <p className="loading" role="status">Cargando diagrama…</p>
        ) : (
          <EmptyState origin={props.origin} />
        )}
        {props.overlay}
      </main>
    </div>
  );
}
