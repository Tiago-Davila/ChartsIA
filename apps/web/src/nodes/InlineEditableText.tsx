import { type CSSProperties, useEffect, useRef, useState } from 'react';

export interface InlineEditableTextProps {
  value: string;
  style: CSSProperties;
  onCommit(value: string): void;
  onCancel(): void;
}

/**
 * Campo de edición superpuesto al texto de una forma (doble clic). Enter o salir del campo
 * confirma; Escape cancela. `nodrag` evita que React Flow arrastre el nodo al seleccionar.
 */
export function InlineEditableText({ value, style, onCommit, onCancel }: InlineEditableTextProps) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = draft.trim();
    if (commit && next && next !== value) onCommit(next);
    else onCancel();
  };

  return (
    <input
      ref={input}
      className="inline-edit nodrag nopan"
      aria-label="Editar texto"
      value={draft}
      style={style}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}
