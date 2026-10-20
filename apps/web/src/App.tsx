import { ReactFlowProvider } from '@xyflow/react';
import { AppShell } from './app/AppShell';

/** Raíz de la app. La fase 9 conecta el `AppShell` al hub (store, REST y tiempo real). */
export function App() {
  return (
    <ReactFlowProvider>
      <AppShell
        diagrams={[]}
        activeDiagramId={null}
        connection="disconnected"
        nodes={[]}
        edges={[]}
        origin={window.location.origin}
        onOpen={() => {}}
        onStyleChange={() => {}}
        onExport={() => {}}
      />
    </ReactFlowProvider>
  );
}
