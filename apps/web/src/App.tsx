import { type ExportFormat } from '@chartsia/core/export';
import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { AppShell } from './app/AppShell';
import { ErrorToast } from './app/ErrorToast';
import { diagramPath, navigate, useRoute } from './app/routes';
import { TokenPrompt } from './app/TokenPrompt';
import { toReactFlow } from './canvas/to-react-flow';
import { useDiagramEdits } from './canvas/use-diagram-edits';
import { useShortcuts } from './canvas/use-shortcuts';
import { DiagramEditContext } from './nodes/edit-context';
import { ApiError } from './state/api-client';
import { setToken } from './state/auth-token';
import { api } from './state/clients';
import { diagramStore, useDiagramStore } from './state/diagram-store';
import { downloadBlob } from './state/download';
import { useHubSync } from './state/use-hub-sync';

const openDiagram = (diagramId: string) => navigate(diagramPath(diagramId));

/** Muestra el error del hub en el aviso; si no hay respuesta del hub, un mensaje genérico. */
function reportError(error: unknown) {
  const store = diagramStore.getState();
  if (error instanceof ApiError && error.errors.length > 0) store.showErrors(error.errors);
  else store.showErrors([{ code: 'SCHEMA_VIOLATION', path: '', message: 'No se pudo contactar con el hub.', hint: 'Comprueba que el hub está en marcha y vuelve a intentarlo.' }]);
}

function ConnectedApp() {
  const route = useRoute();
  const { live, reload } = useHubSync(api, route);
  const diagrams = useDiagramStore((s) => s.diagrams);
  const projects = useDiagramStore((s) => s.projects);
  const activeDiagramId = useDiagramStore((s) => s.activeDiagramId);
  const diagram = useDiagramStore((s) => s.diagram);
  const loading = useDiagramStore((s) => s.openDiagramId !== null && s.diagram === undefined);
  const connection = useDiagramStore((s) => s.connection);
  const needsToken = useDiagramStore((s) => s.needsToken);
  const viewVersion = useDiagramStore((s) => s.viewVersion);
  const changedIds = useDiagramStore((s) => s.lastChangedIds);
  const animate = useDiagramStore((s) => s.lastOrigin === 'agent');
  const edits = useDiagramEdits(api);
  const shortcuts = useMemo(() => ({ history: edits.history, duplicate: edits.duplicate }), [edits.history, edits.duplicate]);
  useShortcuts(shortcuts, diagram !== undefined);

  // `viewVersion` fuerza a rehacer los nodos y descartar cambios optimistas rechazados.
  const flow = useMemo(() => (diagram ? toReactFlow(diagram) : { nodes: [], edges: [] }), [diagram, viewVersion]);

  // Lee la lista del hub (los cambios de otros diagramas no llegan en vivo) y abre el más reciente si no es el abierto.
  const onOpenLatest = useCallback(async () => {
    const list = await api.listDiagrams().catch(() => undefined);
    if (!list || list.diagrams.length === 0) return false;
    diagramStore.getState().setList(list);
    const latest = list.diagrams.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a), list.diagrams[0]!);
    if (latest.diagramId === diagramStore.getState().openDiagramId) return false;
    openDiagram(latest.diagramId);
    return true;
  }, []);

  // Mueve un diagrama de proyecto; la lista se actualiza con el evento `projects.changed`.
  const onMoveDiagram = useCallback(async (diagramId: string, projectId: string | null) => {
    try {
      await api.setDiagramProject(diagramId, projectId);
    } catch (error) {
      reportError(error);
    }
  }, []);

  // Crea el proyecto y mueve el diagrama a él.
  const onNewProject = useCallback(async (diagramId: string, name: string) => {
    try {
      const project = await api.createProject(name);
      await api.setDiagramProject(diagramId, project.id);
    } catch (error) {
      reportError(error);
    }
  }, []);

  const onExport = useCallback(async (format: ExportFormat) => {
    const current = diagramStore.getState().diagram;
    if (!current) return;
    try {
      const { blob, filename } = await api.exportFile(current.id, format);
      downloadBlob(blob, filename);
    } catch (error) {
      if (error instanceof ApiError) diagramStore.getState().showErrors(error.errors);
    }
  }, []);

  if (needsToken) {
    return (
      <TokenPrompt
        onSubmit={(token) => {
          setToken(token);
          diagramStore.getState().setNeedsToken(false);
          live.current?.reconnect();
          reload();
        }}
      />
    );
  }

  return (
    <DiagramEditContext.Provider value={edits.editActions}>
      <div className={`app-root${animate ? ' animate-agent' : ''}`}>
        <AppShell
          diagrams={diagrams}
          projects={projects}
          activeDiagramId={activeDiagramId}
          connection={connection}
          diagram={diagram}
          loading={loading}
          nodes={flow.nodes}
          edges={flow.edges}
          origin={window.location.origin}
          onOpen={openDiagram}
          onMoveDiagram={onMoveDiagram}
          onNewProject={onNewProject}
          onExport={onExport}
          onRename={edits.rename}
          onNodeDragStop={edits.onNodeDragStop}
          onDelete={edits.onDelete}
          onConnect={edits.onConnect}
          onAlign={edits.align}
          changedIds={changedIds}
          onOpenLatest={onOpenLatest}
          onChangedFitted={diagramStore.getState().clearChangedIds}
          overlay={<ErrorToast />}
        />
      </div>
    </DiagramEditContext.Provider>
  );
}

/** Raíz de la app: React Flow + sincronización con el hub. */
export function App() {
  return (
    <ReactFlowProvider>
      <ConnectedApp />
    </ReactFlowProvider>
  );
}
