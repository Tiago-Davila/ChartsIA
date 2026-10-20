import { ReactFlowProvider } from '@xyflow/react';
import { useRoute } from './app/routes';

/** Raíz de la app. El `AppShell` (fase 8) compone la barra lateral, la toolbar y el lienzo. */
export function App() {
  const route = useRoute();
  return (
    <ReactFlowProvider>
      <main data-route={route.name}>ChartsIA</main>
    </ReactFlowProvider>
  );
}
