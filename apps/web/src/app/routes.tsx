import { useCallback, useSyncExternalStore } from 'react';

export type Route = { name: 'home' } | { name: 'config' } | { name: 'diagram'; diagramId: string };

const DIAGRAM_PATH = /^\/d\/([^/]+)\/?$/;
const ID_COMPLETO = /^dg_[a-z2-7]{12}$/;
const ID_AL_FINAL = /-([a-z2-7]{12})$/;

/** Pasa un título a slug para la dirección: minúsculas, sin acentos, palabras unidas con guiones. */
export function slugify(titulo: string): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'diagrama';
}

/** Saca el id del segmento `/d/…`: `dg_<12>` (dirección vieja) o `<slug>-<12>`; el slug no cuenta. */
export function diagramIdFromSegment(segmento: string): string {
  if (ID_COMPLETO.test(segmento)) return segmento;
  const corto = ID_AL_FINAL.exec(segmento);
  return corto ? `dg_${corto[1]}` : segmento;
}

export function parseRoute(pathname: string): Route {
  if (pathname === '/config') return { name: 'config' };
  const match = DIAGRAM_PATH.exec(pathname);
  return match ? { name: 'diagram', diagramId: diagramIdFromSegment(decodeURIComponent(match[1]!)) } : { name: 'home' };
}

/** Dirección de un diagrama: `/d/<slug-del-título>-<parte-única-del-id>`; el slug es decorativo. */
export function diagramPath(diagramId: string, titulo = ''): string {
  return `/d/${slugify(titulo)}-${diagramId.replace(/^dg_/, '')}`;
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
