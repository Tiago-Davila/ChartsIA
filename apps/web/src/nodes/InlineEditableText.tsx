import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { applySuggestion, type TypeContext } from '../canvas/type-suggestions';

export interface Suggestions {
  context: TypeContext;
  items: string[];
}

export interface InlineEditableTextProps {
  value: string;
  style: CSSProperties;
  onCommit(value: string): void;
  onCancel(): void;
  /** Sugerencias para la posición del cursor (autocompletado de tipos). */
  suggest?(text: string, caret: number): Suggestions | undefined;
}

/**
 * Campo de edición superpuesto al texto de una forma (doble clic). Enter o salir del campo
 * confirma; Escape cancela. `nodrag` evita que React Flow arrastre el nodo al seleccionar.
 */
export function InlineEditableText({ value, style, onCommit, onCancel, suggest }: InlineEditableTextProps) {
  const [draft, setDraft] = useState(value);
  const [list, setList] = useState<Suggestions>();
  const [active, setActive] = useState(0);
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

  // Recalcula la lista según el texto y la posición del cursor.
  const refresh = (text: string, caret: number | null) => {
    const found = suggest && caret !== null ? suggest(text, caret) : undefined;
    setList(found && found.items.length > 0 ? found : undefined);
    setActive(0);
  };

  const choose = (type: string) => {
    if (!list) return;
    const next = applySuggestion(draft, list.context, type);
    setDraft(next.text);
    setList(undefined);
    requestAnimationFrame(() => input.current?.setSelectionRange(next.caret, next.caret));
  };

  return (
    <>
      <input
        ref={input}
        className="inline-edit nodrag nopan"
        aria-label="Editar texto"
        role={suggest ? 'combobox' : undefined}
        aria-expanded={suggest ? list !== undefined : undefined}
        aria-controls={suggest ? 'type-suggestions' : undefined}
        value={draft}
        style={style}
        onChange={(e) => {
          setDraft(e.target.value);
          refresh(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => refresh(draft, e.currentTarget.selectionStart)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (list && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            setActive((i) => (i + step + list.items.length) % list.items.length);
            return;
          }
          if (list && (e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault();
            choose(list.items[active]!);
            return;
          }
          if (list && e.key === 'Escape') {
            setList(undefined);
            return;
          }
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') finish(false);
        }}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') refresh(draft, e.currentTarget.selectionStart);
        }}
      />
      {list ? (
        <ul
          id="type-suggestions"
          role="listbox"
          aria-label="Tipos sugeridos"
          className="type-suggestions nodrag nopan nowheel"
          style={{ left: style.left, top: Number(style.top ?? 0) + Number(style.height ?? 0) + 2 }}
        >
          {list.items.map((type, i) => (
            <li
              key={type}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              // mousedown evita que el campo pierda el foco y confirme antes de elegir.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(type);
              }}
            >
              {type}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
