import { useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface ResizeHandleProps {
  label: string;
  /** Lado de la barra en que está el tirador: a la derecha de la barra izquierda o a la izquierda de la derecha. */
  edge: 'right' | 'left';
  value: number;
  min: number;
  max: number;
  /** Ancho al hacer doble clic. */
  initial: number;
  onChange(width: number): void;
}

const KEY_STEP = 16;

/** Ajusta un ancho al rango permitido. */
export function clampWidth(width: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** Guarda en el navegador el ancho de una barra; si no hay almacenamiento usa el inicial. */
export function usePanelWidth(key: string, initial: number, min: number, max: number): [number, (width: number) => void] {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key));
      return saved ? clampWidth(saved, min, max) : initial;
    } catch {
      return initial;
    }
  });
  const update = (next: number) => {
    const value = clampWidth(next, min, max);
    setWidth(value);
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Sin almacenamiento el ancho dura hasta recargar.
    }
  };
  return [width, update];
}

/** Tirador vertical que cambia el ancho de una barra arrastrando, con flechas o con doble clic para volver al inicial. */
export function ResizeHandle({ label, edge, value, min, max, initial, onChange }: ResizeHandleProps) {
  const [drag, setDrag] = useState<{ id: number; x: number; width: number } | null>(null);
  // La barra izquierda crece hacia la derecha y la derecha hacia la izquierda.
  const sign = edge === 'right' ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ id: e.pointerId, x: e.clientX, width: value });
    document.body.classList.add('is-resizing');
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag?.id !== e.pointerId) return;
    onChange(clampWidth(drag.width + sign * (e.clientX - drag.x), min, max));
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (drag?.id !== e.pointerId) return;
    setDrag(null);
    document.body.classList.remove('is-resizing');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : 0;
    if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else if (delta) onChange(clampWidth(value + sign * delta, min, max));
    else return;
    e.preventDefault();
  };

  return (
    <div
      className={`resize-handle resize-handle--${edge}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-dragging={drag ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={() => onChange(initial)}
      onKeyDown={onKeyDown}
    />
  );
}
