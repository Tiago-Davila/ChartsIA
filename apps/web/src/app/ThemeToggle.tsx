import { useState } from 'react';
import { applyTheme, type Theme } from './theme';

/** Botón que alterna entre el tema claro y el oscuro. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="button theme-toggle"
      aria-label={next === 'dark' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      title={next === 'dark' ? 'Tema oscuro' : 'Tema claro'}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
      {next === 'dark' ? 'Oscuro' : 'Claro'}
    </button>
  );
}
