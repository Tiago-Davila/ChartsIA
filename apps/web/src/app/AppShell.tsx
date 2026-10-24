import { type ExportFormat } from '@chartsia/core/export';
import { type Diagram, type DiagramType, type Point } from '@chartsia/core/model';
import { type Edge, type Node } from '@xyflow/react';
import { type ClipboardEvent, type CSSProperties, type DragEvent, type ReactNode, useRef } from 'react';
import { type ConnectedAgent, type Project } from '../state/api-client';
import { type AlignMode } from '../canvas/align';
import { DiagramCanvas, type DiagramCanvasProps } from '../canvas/DiagramCanvas';
import { FigureSidebar } from '../canvas/FigureSidebar';
import { FIGURE_DRAG_TYPE, type FrameBox } from '../canvas/figure-palette';
import { C4Legend } from '../legend/C4Legend';
import { ConfigScreen } from './ConfigScreen';
import { type ConnectionState, CONNECTION_LABELS } from './ConnectionStatus';
import { DiagramList, type DiagramListItem } from './DiagramList';
import { EmptyState } from './EmptyState';
import { GearIcon } from './icons';
import { NewDiagram } from './NewDiagram';
import { ResizeHandle, usePanelWidth } from './ResizeHandle';
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
  onRenameProject(projectId: string, name: string): void;
  onDeleteProject(projectId: string): void;
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
  onDuplicate?: DiagramCanvasProps['onDuplicate'];
  onCopy?: DiagramCanvasProps['onCopy'];
  onCut?: DiagramCanvasProps['onCut'];
  onPaste?: DiagramCanvasProps['onPaste'];
  onReorder?: DiagramCanvasProps['onReorder'];
  onToggleLock?: DiagramCanvasProps['onToggleLock'];
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

/** Anchos de las barras en píxeles: inicial, mínimo y máximo. */
const SIDEBAR = { initial: 260, min: 200, max: 480 };
const FIGURES = { initial: 208, min: 160, max: 420 };

/** Composición de la app: barra lateral, toolbar, lienzo, leyenda y estado vacío. */
export function AppShell(props: AppShellProps) {
  const { diagram } = props;
  const [sidebarWidth, setSidebarWidth] = usePanelWidth('chartsia.sidebar-width', SIDEBAR.initial, SIDEBAR.min, SIDEBAR.max);
  const [figuresWidth, setFiguresWidth] = usePanelWidth('chartsia.figures-width', FIGURES.initial, FIGURES.min, FIGURES.max);
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
    <div className={`app-shell${showFigures ? ' app-shell--figures' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px`, '--figures-width': `${figuresWidth}px` } as CSSProperties}>
      <aside className="app-shell__sidebar">
        <div className="brand">
          {/* Lugar reservado para el logo de ChartsIA. */}
          <span className="brand__logo" role="img" aria-label="ChartsIA" />
        </div>
        <div className="app-shell__sidebar-scroll">
          <NewDiagram projects={props.projects} onCreate={props.onCreateDiagram} onImportMermaid={props.onImportMermaid} />
          <DiagramList diagrams={props.diagrams} projects={props.projects} activeDiagramId={props.activeDiagramId} openDiagramId={diagram?.id ?? null} onOpen={props.onOpen} onMove={props.onMoveDiagram} onNewProject={props.onNewProject} onRenameProject={props.onRenameProject} onDeleteProject={props.onDeleteProject} onRename={props.onRenameDiagram} onDelete={props.onDeleteDiagram} />
        </div>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-nav__row sidebar-config" aria-pressed={props.configOpen} onClick={props.onConfig}>
            Configuración
            {props.connection !== 'connected' ? <span className={`sidebar-config__dot connection--${props.connection}`} aria-hidden title={CONNECTION_LABELS[props.connection]} /> : null}
            <GearIcon />
          </button>
          {/* El estado de la conexión solo se anuncia; en pantalla queda el punto de aviso cuando falla. */}
          <span className="sr-only" role="status" aria-live="polite">
            {CONNECTION_LABELS[props.connection]}
          </span>
        </div>
        <ResizeHandle label="Ancho de la barra de diagramas" edge="right" value={sidebarWidth} min={SIDEBAR.min} max={SIDEBAR.max} initial={SIDEBAR.initial} onChange={setSidebarWidth} />
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
            />
            <div className="app-shell__canvas" ref={canvas} onDragOver={onDragOver} onDrop={onDrop}>
              <DiagramCanvas
                diagramId={diagram.id}
                nodes={props.nodes}
                edges={props.edges}
                readOnly={props.readOnly}
                onNodeDragStop={props.onNodeDragStop}
                onDelete={props.onDelete}
                onDuplicate={props.onDuplicate}
                onCopy={props.onCopy}
                onCut={props.onCut}
                onPaste={props.onPaste}
                onReorder={props.onReorder}
                onToggleLock={props.onToggleLock}
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
      {showFigures ? (
        <div className="app-shell__figures">
          <ResizeHandle label="Ancho de la barra de figuras" edge="left" value={figuresWidth} min={FIGURES.min} max={FIGURES.max} initial={FIGURES.initial} onChange={setFiguresWidth} />
          <FigureSidebar diagramType={diagram?.type} onAdd={(key) => props.onAddFigureAtCenter?.(key, center())} />
        </div>
      ) : null}
    </div>
  );
}
