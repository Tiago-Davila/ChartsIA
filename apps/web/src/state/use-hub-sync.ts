import { useEffect, useRef } from 'react';
import { diagramPath, navigate, type Route } from '../app/routes';
import { ApiError, type ApiClient } from './api-client';
import { diagramStore, useDiagramStore } from './diagram-store';
import { createLiveClient, type LiveClient } from './live-client';
import { getToken } from './auth-token';

function report(error: unknown) {
  const store = diagramStore.getState();
  if (error instanceof ApiError && error.unauthorized) store.setNeedsToken(true);
  else if (error instanceof ApiError && error.errors.length > 0) store.showErrors(error.errors);
}

/**
 * Sincroniza la app con el hub (FR-021): lista inicial, diagrama abierto según la ruta,
 * eventos en vivo y reconciliación tras reconectar. La app sigue al diagrama activo cuando un
 * agente crea o abre otro (`active.changed`).
 */
export function useHubSync(api: ApiClient, route: Route): { live: React.RefObject<LiveClient | null>; reload(): void } {
  const live = useRef<LiveClient | null>(null);
  const openDiagramId = useDiagramStore((s) => s.openDiagramId);
  const activeDiagramId = useDiagramStore((s) => s.activeDiagramId);
  const listLoaded = useRef(false);

  const reload = () => {
    api
      .listDiagrams()
      .then((list) => {
        listLoaded.current = true;
        diagramStore.getState().setList(list);
      })
      .catch(report);
    const open = diagramStore.getState().openDiagramId;
    if (open) api.getDiagram(open).then((d) => diagramStore.getState().reconcile(d)).catch(report);
  };
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // Canal en vivo: se abre una vez por montaje.
  useEffect(() => {
    const store = diagramStore.getState;
    const client = createLiveClient(getToken, {
      onUpdated: (e) => store().applyUpdate(e),
      onCreated: (e) => store().diagramCreated(e),
      onActiveChanged: ({ diagramId }) => {
        store().setActive(diagramId);
        navigate(diagramPath(diagramId));
      },
      onStatus: (s) => store().setConnection(s),
      onConnected: () => reloadRef.current(),
      onUnauthorized: () => store().setNeedsToken(true),
    });
    live.current = client;
    return () => {
      client.close();
      live.current = null;
    };
  }, []);

  // Ruta → diagrama abierto.
  const routeId = route.name === 'diagram' ? route.diagramId : null;
  useEffect(() => {
    if (routeId) diagramStore.getState().open(routeId);
  }, [routeId]);

  // En "/" se abre el diagrama activo, si lo hay.
  useEffect(() => {
    if (!routeId && activeDiagramId) navigate(diagramPath(activeDiagramId), { replace: true });
  }, [routeId, activeDiagramId]);

  // Diagrama abierto → cargarlo, suscribirse y marcarlo activo para los agentes.
  useEffect(() => {
    if (!openDiagramId) return;
    live.current?.subscribe(openDiagramId);
    let cancelled = false;
    api
      .getDiagram(openDiagramId)
      .then((d) => {
        if (!cancelled) diagramStore.getState().receiveDiagram(d);
      })
      .catch((error) => {
        report(error);
        if (error instanceof ApiError && error.status === 404) navigate('/', { replace: true });
      });
    if (openDiagramId !== diagramStore.getState().activeDiagramId) {
      diagramStore.getState().setActive(openDiagramId);
      api.activate(openDiagramId).catch(report);
    }
    return () => {
      cancelled = true;
    };
  }, [api, openDiagramId]);

  return { live, reload: () => reloadRef.current() };
}
