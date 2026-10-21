import { useCallback, useSyncExternalStore } from 'react';

export type Route = { name: 'home' } | { name: 'config' } | { name: 'diagram'; diagramId: string };

const DIAGRAM_PATH = /^\/d\/([^/]+)\/?$/;

export function parseRoute(pathname: string): Route {
  if (pathname === '/config') return { name: 'config' };
  const match = DIAGRAM_PATH.exec(pathname);
  return match ? { name: 'diagram', diagramId: decodeURIComponent(match[1]!) } : { name: 'home' };
}

export function diagramPath(diagramId: string): string {
  return `/d/${encodeURIComponent(diagramId)}`;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const getPath = () => window.location.pathname;

/** Navega sin recargar; `replace` evita apilar entradas al seguir al diagrama activo. */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (window.location.pathname === path) return;
  if (options.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  listeners.forEach((l) => l());
}

/**
 * Enrutado mínimo de la app: `/` (diagrama activo o estado vacío), `/d/:id` (destino de
 * `viewUrl`) y `/config` (conexión de agentes). Tres rutas no justifican una dependencia de router (principio VI).
 */
export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, getPath, () => '/');
  return parseRoute(path);
}

export function useNavigate(): (path: string, options?: { replace?: boolean }) => void {
  return useCallback((path, options) => navigate(path, options), []);
}
