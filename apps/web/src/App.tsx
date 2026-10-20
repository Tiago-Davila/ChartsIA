import { type ExportFormat } from '@chartsia/core/export';
import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useMemo } from 'react';
import { AppShell } from './app/AppShell';
import { ErrorToast } from './app/ErrorToast';
import { diagramPath, navigate, useRoute } from './app/routes';
import { TokenPrompt } from './app/TokenPrompt';
import { toReactFlow } from './canvas/to-react-flow';
import { useDiagramEdits } from './canvas/use-diagram-edits';
import { DiagramEditContext } from './nodes/edit-context';
import { ApiError } from './state/api-client';
import { setToken } from './state/auth-token';
import { api } from './state/clients';
import { diagramStore, useDiagramStore } from './state/diagram-store';
import { downloadBlob } from './state/download';
import { useHubSync } from './state/use-hub-sync';

const openDiagram = (diagramId: string) => navigate(diagramPath(diagramId));

function ConnectedApp() {
  const route = useRoute();
  const { live, reload } = useHubSync(api, route);
  const diagrams = useDiagramStore((s) => s.diagrams);
  const activeDiagramId = useDiagramStore((s) => s.activeDiagramId);
  const diagram = useDiagramStore((s) => s.diagram);
  const loading = useDiagramStore((s) => s.openDiagramId !== null && s.diagram === undefined);
  const connection = useDiagramStore((s) => s.connection);
  const needsToken = useDiagramStore((s) => s.needsToken);
  const viewVersion = useDiagramStore((s) => s.viewVersion);
  const animate = useDiagramStore((s) => s.lastOrigin === 'agent');
  const edits = useDiagramEdits(api);

  // `viewVersion` fuerza a rehacer los nodos y descartar cambios optimistas rechazados.
  const flow = useMemo(() => (diagram ? toReactFlow(diagram) : { nodes: [], edges: [] }), [diagram, viewVersion]);

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
          activeDiagramId={activeDiagramId}
          connection={connection}
          diagram={diagram}
          loading={loading}
          nodes={flow.nodes}
          edges={flow.edges}
          origin={window.location.origin}
          onOpen={openDiagram}
          onExport={onExport}
          onNodeDragStop={edits.onNodeDragStop}
          onDelete={edits.onDelete}
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
