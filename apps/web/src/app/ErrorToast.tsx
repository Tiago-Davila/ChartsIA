import { useEffect } from 'react';
import { diagramStore, useDiagramStore } from '../state/diagram-store';

const AUTO_DISMISS_MS = 10_000;

/** Errores de validación del hub (422) con su `message` y su `hint`; nada cambia en el lienzo. */
export function ErrorToast() {
  const errors = useDiagramStore((s) => s.errors);
  useEffect(() => {
    if (errors.length === 0) return;
    const timer = setTimeout(() => diagramStore.getState().dismissErrors(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [errors]);
  if (errors.length === 0) return null;
  return (
    <div className="toast-region">
      <div className="toast" role="alert">
        <p className="toast__title">
          No se aplicó el cambio
          <button type="button" aria-label="Cerrar" onClick={() => diagramStore.getState().dismissErrors()}>
            ×
          </button>
        </p>
        <ul>
          {errors.map((e, i) => (
            <li key={i}>
              {e.message} <span className="toast__hint">{e.hint}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
