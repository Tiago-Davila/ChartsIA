import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface ModalProps {
  titulo: string;
  onCerrar(): void;
  children: ReactNode;
}

const ENFOCABLES =
  'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Ventana modal base: foco inicial dentro, Escape y clic en el fondo la cierran. Los hijos son el cuerpo. */
export function Modal({ titulo, onCerrar, children }: ModalProps) {
  const id = useId();
  const ventana = useRef<HTMLDivElement>(null);

  // Enfoca el primer campo o botón al abrir y devuelve el foco a donde estaba al cerrar.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ventana.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus();
    return () => previo?.focus();
  }, []);

  // Escape cierra; Tab da vueltas dentro de la ventana en vez de salir a la página.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
      if (e.key !== 'Tab' || !ventana.current) return;
      const enfocables = ventana.current.querySelectorAll<HTMLElement>(ENFOCABLES);
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  // Solo el mousedown directo sobre el fondo cierra; arrastrar desde un campo hasta fuera no.
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={ventana} className="modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <h2 id={id} className="modal__title">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}
