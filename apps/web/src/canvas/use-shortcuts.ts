import { useEffect } from 'react';

export interface ShortcutActions {
  history(direction: 'undo' | 'redo'): void;
  duplicate(): void;
  copy(): void;
  cut(): void;
  paste(): void;
}

/** Ignora los atajos mientras se escribe en un campo de texto (no en listas ni selectores de color). */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement && target.type === 'color') return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName);
}

/** Atajos globales del lienzo: Ctrl+Z deshace, Ctrl+Shift+Z y Ctrl+Y rehacen, Ctrl+D duplica, Ctrl+C copia, Ctrl+X corta y Ctrl+V pega. */
export function useShortcuts(actions: ShortcutActions, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        actions.history(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      } else if (key === 'd') {
        e.preventDefault();
        actions.duplicate();
      } else if (key === 'c') {
        e.preventDefault();
        actions.copy();
      } else if (key === 'x') {
        e.preventDefault();
        actions.cut();
      } else if (key === 'v') {
        actions.paste();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, enabled]);
}
