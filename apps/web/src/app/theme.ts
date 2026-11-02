export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const STORAGE_KEY = 'chartsia.theme';

let dejarDeSeguirAlSistema: (() => void) | undefined;

/** Devuelve la preferencia guardada o, si no hay, la de seguir al sistema. */
export function initialTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Sin acceso al almacenamiento: se sigue al sistema.
  }
  return 'system';
}

/** Aplica la preferencia al documento, la recuerda y, con `system`, sigue los cambios del sistema. */
export function applyTheme(preference: ThemePreference): void {
  dejarDeSeguirAlSistema?.();
  dejarDeSeguirAlSistema = undefined;
  const sistema = window.matchMedia?.('(prefers-color-scheme: dark)');
  const aplicar = () => {
    document.documentElement.dataset.theme = preference === 'system' ? (sistema?.matches ? 'dark' : 'light') : preference;
  };
  aplicar();
  if (preference === 'system' && sistema) {
    sistema.addEventListener('change', aplicar);
    dejarDeSeguirAlSistema = () => sistema.removeEventListener('change', aplicar);
  }
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Si no se puede guardar, el tema vale solo para esta sesión.
  }
}
