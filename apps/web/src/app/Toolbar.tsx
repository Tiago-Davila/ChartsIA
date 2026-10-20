import { type ExportFormat } from '@chartsia/core/export';
import { getViewportForBounds, useNodes, useReactFlow, useStoreApi } from '@xyflow/react';
import { useRef } from 'react';
import { type AlignMode } from '../canvas/align';
import { FIT_VIEW_OPTIONS } from '../canvas/DiagramCanvas';

export interface ToolbarProps {
  title: string;
  revision?: number;
  disabled?: boolean;
  onExport(format: ExportFormat): void;
  onAlign?(mode: AlignMode): void;
  /** Ids que tocó el último cambio; vacío encuadra todo el diagrama. */
  changedIds?: string[];
  /** Abre el diagrama modificado más recientemente; devuelve true si era otro (el lienzo lo encuadra al cargar). */
  onOpenLatest?(): Promise<boolean>;
}

const EXPORTS: { value: ExportFormat; label: string }[] = [
  { value: 'svg', label: 'SVG (imagen)' },
  { value: 'drawio', label: 'draw.io (.drawio)' },
  { value: 'excalidraw', label: 'Excalidraw (.excalidraw)' },
];

const ALIGNS: { value: AlignMode; label: string }[] = [
  { value: 'left', label: 'Alinear a la izquierda' },
  { value: 'center', label: 'Centrar en horizontal' },
  { value: 'right', label: 'Alinear a la derecha' },
  { value: 'top', label: 'Alinear arriba' },
  { value: 'middle', label: 'Centrar en vertical' },
  { value: 'bottom', label: 'Alinear abajo' },
  { value: 'distribute-x', label: 'Repartir en horizontal' },
  { value: 'distribute-y', label: 'Repartir en vertical' },
];

/** Menú desplegable de la barra; se cierra al elegir una opción. */
function Menu<T extends string>({ label, items, primary, disabled, onSelect }: { label: string; items: { value: T; label: string }[]; primary?: boolean; disabled: boolean; onSelect(value: T): void }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details className="menu" ref={menu}>
      <summary className={`button${primary ? ' button--primary' : ''}${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled}>
        {label}
      </summary>
      <ul role="menu">
        {items.map((item) => (
          <li key={item.value} role="none">
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                menu.current?.removeAttribute('open');
                onSelect(item.value);
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Título, encuadre, alineación de la selección y exportación (FR-027). */
export function Toolbar({ title, revision, disabled = false, onExport, onAlign, changedIds = [], onOpenLatest }: ToolbarProps) {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow();
  const store = useStoreApi();
  // Encuadra los nodos del último cambio (o todos) con su tamaño declarado, porque fitView espera nodos medidos y tras un cambio del hub no responde.
  const fit = async () => {
    if (await onOpenLatest?.()) return;
    const { width, height, minZoom } = store.getState();
    const all = getNodes();
    const changed = all.filter((n) => changedIds.includes(n.id));
    const viewport = getViewportForBounds(getNodesBounds(changed.length > 0 ? changed : all), width, height, minZoom, FIT_VIEW_OPTIONS.maxZoom, FIT_VIEW_OPTIONS.padding);
    void setViewport(viewport, { duration: 300 });
  };
  const selected = useNodes().filter((n) => n.selected).length;
  return (
    <header className="toolbar">
      <h1 className="toolbar__title" title={title}>
        {title}
        {revision !== undefined ? <span className="toolbar__revision">rev {revision}</span> : null}
      </h1>
      {onAlign && selected >= 2 ? <Menu label="Alinear" items={ALIGNS} disabled={disabled} onSelect={onAlign} /> : null}
      <button type="button" className="button" disabled={disabled} onClick={() => void fit()}>
        Ajustar
      </button>
      <Menu label="Exportar" items={EXPORTS} primary disabled={disabled} onSelect={onExport} />
    </header>
  );
}
