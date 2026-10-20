import { useEffect } from 'react';

export interface ShortcutActions {
  history(direction: 'undo' | 'redo'): void;
}

/** Ignora los atajos mientras se escribe en un campo de texto. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Atajos globales del lienzo: Ctrl+Z deshace, Ctrl+Shift+Z y Ctrl+Y rehacen. */
export function useShortcuts(actions: ShortcutActions, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        actions.history(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, enabled]);
}
