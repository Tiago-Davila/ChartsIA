const KEY = 'chartsia.token';

function storage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Lee el token del fragmento `#token=…` (no viaja al servidor ni queda en logs), lo guarda en
 * `sessionStorage` y lo quita de la barra de direcciones. Devuelve el token vigente.
 */
export function captureTokenFromLocation(): string | undefined {
  const match = /(?:^#|&)token=([^&]+)/.exec(window.location.hash);
  if (match) {
    setToken(decodeURIComponent(match[1]!));
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, '', pathname + search);
  }
  return getToken();
}

export function getToken(): string | undefined {
  try {
    return storage()?.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setToken(token: string): void {
  try {
    storage()?.setItem(KEY, token);
  } catch {
    // Sin almacenamiento (modo privado): el token vive solo en esta pestaña vía fragmento.
  }
}

export function clearToken(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nada que limpiar
  }
}
