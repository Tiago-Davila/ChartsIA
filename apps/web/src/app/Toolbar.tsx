import { type ExportFormat } from '@chartsia/core/export';
import { useReactFlow } from '@xyflow/react';
import { useRef } from 'react';

export interface ToolbarProps {
  title: string;
  revision?: number;
  disabled?: boolean;
  onExport(format: ExportFormat): void;
}

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: 'svg', label: 'SVG (imagen)' },
  { format: 'drawio', label: 'draw.io (.drawio)' },
  { format: 'excalidraw', label: 'Excalidraw (.excalidraw)' },
];

/** Título, encuadre y exportación (FR-027). */
export function Toolbar({ title, revision, disabled = false, onExport }: ToolbarProps) {
  const { fitView } = useReactFlow();
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <header className="toolbar">
      <h1 className="toolbar__title" title={title}>
        {title}
        {revision !== undefined ? <span className="toolbar__revision">rev {revision}</span> : null}
      </h1>
      <button type="button" className="button" disabled={disabled} onClick={() => void fitView({ padding: 0.15, duration: 300 })}>
        Ajustar
      </button>
      <details className="menu" ref={menu}>
        <summary className={`button button--primary${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled}>
          Exportar
        </summary>
        <ul role="menu">
          {EXPORTS.map((e) => (
            <li key={e.format} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  menu.current?.removeAttribute('open');
                  onExport(e.format);
                }}
              >
                {e.label}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </header>
  );
}
