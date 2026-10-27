import { useEffect } from 'react';

/** Indica si un texto es XML de draw.io: un mxGraphModel o un mxfile, a veces codificado como URL. */
export function esDrawio(text: string): boolean {
  return /^\s*(<|%3C)(mxGraphModel|mxfile)\b/i.test(text);
}

/** Los campos de texto conservan su pegado normal. */
function estaEscribiendo(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA'].includes(target.tagName));
}

/** Ctrl+V de lo copiado en draw.io fuera de un campo de texto: importa el XML como un diagrama nuevo. */
export function usePasteDrawio(onImport: (source: string) => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (event: ClipboardEvent) => {
      if (estaEscribiendo(event.target)) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      if (!esDrawio(text)) return;
      event.preventDefault();
      onImport(text);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [onImport, enabled]);
}
