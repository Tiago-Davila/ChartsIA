import { type ExportFormat } from '@chartsia/core/export';
import { type Diagram, type DiagramType, type Point } from '@chartsia/core/model';
import { type Edge, type Node } from '@xyflow/react';
import { type ClipboardEvent, type DragEvent, type ReactNode, useRef } from 'react';
import { type ConnectedAgent, type Project } from '../state/api-client';
import { type AlignMode } from '../canvas/align';
import { DiagramCanvas, type DiagramCanvasProps } from '../canvas/DiagramCanvas';
import { FigureSidebar } from '../canvas/FigureSidebar';
import { FIGURE_DRAG_TYPE, type FrameBox } from '../canvas/figure-palette';
import { C4Legend } from '../legend/C4Legend';
import { ConfigScreen } from './ConfigScreen';
import { ConnectionStatus, type ConnectionState } from './ConnectionStatus';
import { DiagramList, type DiagramListItem } from './DiagramList';
import { EmptyState } from './EmptyState';
import { NewDiagram } from './NewDiagram';
import { Toolbar } from './Toolbar';

export interface AppShellProps {
  diagrams: DiagramListItem[];
  projects: Project[];
  agents: ConnectedAgent[];
  activeDiagramId: string | null;
  connection: ConnectionState;
  diagram?: Diagram;
  /** Hay un diagrama abierto que aún se está cargando. */
  loading?: boolean;
  nodes: Node[];
  edges: Edge[];
  origin: string;
  /** Muestra la pantalla de configuración en lugar del lienzo. */
  configOpen?: boolean;
  onConfig(): void;
  onCloseConfig(): void;
  readOnly?: boolean;
  onOpen(diagramId: string): void;
  onCreateDiagram(type: DiagramType, title: string, projectId?: string): void;
  onImportMermaid(source: string, title?: string, projectId?: string): Promise<string[] | null>;
  onMoveDiagram(diagramId: string, projectId: string | null): void;
  onNewProject(diagramId: string, name: string): void;
  onRenameDiagram(diagramId: string, title: string): void;
  onDeleteDiagram(diagramId: string): void;
  onExport(format: ExportFormat): void;
  onImportImages?(files: File[], screenPosition?: { x: number; y: number }): void;
  onAddFigure?(key: string, screenPosition: { x: number; y: number }): void;
  /** Doble clic en la barra: agrega la figura centrada en el centro de la vista. */
  onAddFigureAtCenter?(key: string, screenCenter: { x: number; y: number }): void;
  onRename?(title: string): void;
  onNodeDragStop?: DiagramCanvasProps['onNodeDragStop'];
  onDelete?: DiagramCanvasProps['onDelete'];
  onConnect?: DiagramCanvasProps['onConnect'];
  onDraw?: (points: Point[], screenPoints: Point[], color: string, width: number, highlighter: boolean) => void;
  onAddText?(screenPosition: { x: number; y: number }): void;
  onAddFrame?(box: FrameBox): void;
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
  const canvas = useRef<HTMLDivElement>(null);
  const center = () => {
    const rect = canvas.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
  };
  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    if (props.readOnly || !props.onImportImages) return;
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length === 0) return;
    event.preventDefault();
    props.onImportImages(files, center());
  };
  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types);
    const isFigure = !!props.onAddFigure && types.includes(FIGURE_DRAG_TYPE);
    const isFile = !!props.onImportImages && types.includes('Files');
    if (props.readOnly || (!isFigure && !isFile)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (props.readOnly) return;
    const figure = event.dataTransfer.getData(FIGURE_DRAG_TYPE);
    if (figure && props.onAddFigure) {
      event.preventDefault();
      props.onAddFigure(figure, { x: event.clientX, y: event.clientY });
      return;
    }
    if (!props.onImportImages || event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    props.onImportImages(Array.from(event.dataTransfer.files), { x: event.clientX, y: event.clientY });
  };
  const showFigures = !!diagram && !props.configOpen && !props.readOnly && !!props.onAddFigure;
  return (
    <div className={`app-shell${showFigures ? ' app-shell--figures' : ''}`}>
      <aside className="app-shell__sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden>◆</span> ChartsIA
        </div>
        <NewDiagram projects={props.projects} onCreate={props.onCreateDiagram} onImportMermaid={props.onImportMermaid} />
        <DiagramList diagrams={props.diagrams} projects={props.projects} activeDiagramId={props.activeDiagramId} openDiagramId={diagram?.id ?? null} onOpen={props.onOpen} onMove={props.onMoveDiagram} onNewProject={props.onNewProject} onRename={props.onRenameDiagram} onDelete={props.onDeleteDiagram} />
        <button type="button" className="button sidebar-config" aria-label="Configuración" aria-pressed={props.configOpen} onClick={props.onConfig}>
          <span aria-hidden>⚙</span>
        </button>
        <ConnectionStatus state={props.connection} />
      </aside>
      <main className="app-shell__main" onPaste={onPaste}>
        {props.configOpen ? (
          <ConfigScreen origin={props.origin} agents={props.agents} connection={props.connection} onBack={props.onCloseConfig} />
        ) : diagram ? (
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
              onInsertImages={(files) => props.onImportImages?.(files, center())}
            />
            <div className="app-shell__canvas" ref={canvas} onDragOver={onDragOver} onDrop={onDrop}>
              <DiagramCanvas
                diagramId={diagram.id}
                nodes={props.nodes}
                edges={props.edges}
                readOnly={props.readOnly}
                onNodeDragStop={props.onNodeDragStop}
                onDelete={props.onDelete}
                onConnect={props.onConnect}
                onDraw={props.onDraw}
                onAddText={props.onAddText}
                onAddFrame={props.onAddFrame}
              />
              <C4Legend diagram={diagram} />
            </div>
          </>
        ) : props.loading ? (
          <p className="loading" role="status">Cargando diagrama…</p>
        ) : (
          <EmptyState onConfig={props.onConfig} />
        )}
        {props.overlay}
      </main>
      {showFigures ? <FigureSidebar diagramType={diagram?.type} onAdd={(key) => props.onAddFigureAtCenter?.(key, center())} /> : null}
    </div>
  );
}
