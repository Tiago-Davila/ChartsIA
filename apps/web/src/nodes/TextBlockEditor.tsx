import { useEffect, useRef, useState } from 'react';

export interface TextBlockEditorProps {
  /** Markdown actual del bloque. */
  value: string;
  width: number;
  height: number;
  onCommit(value: string): void;
  onCancel(): void;
}

/** Largo máximo del markdown de un bloque; coincide con el del núcleo. */
const MAX_LENGTH = 4000;

/**
 * Editor multilínea del bloque de texto: escribe el markdown sobre el propio bloque. Salir del
 * campo o Ctrl+Enter confirman; Escape cancela. `nodrag` evita que React Flow mueva el nodo.
 */
export function TextBlockEditor({ value, width, height, onCommit, onCancel }: TextBlockEditorProps) {
  const [draft, setDraft] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    area.current?.focus();
    area.current?.select();
  }, []);

  // Confirma solo una vez: Ctrl+Enter y el blur que lo sigue no deben guardar dos veces.
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = draft.replace(/\s+$/, '');
    if (commit && next.trim() !== '' && next !== value) onCommit(next);
    else onCancel();
  };

  return (
    <textarea
      ref={area}
      className="text-block-editor nodrag nopan nowheel"
      aria-label="Editar bloque de texto"
      value={draft}
      maxLength={MAX_LENGTH}
      spellCheck={false}
      style={{ width, height }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') finish(false);
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) finish(true);
      }}
    />
  );
}
