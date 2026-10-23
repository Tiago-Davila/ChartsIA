export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'chartsia.theme';

/** Devuelve el tema guardado o, si no hay, el que prefiere el sistema. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Sin acceso al almacenamiento: se usa la preferencia del sistema.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Aplica el tema al documento y lo recuerda para la próxima visita. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Si no se puede guardar, el tema vale solo para esta sesión.
  }
}
