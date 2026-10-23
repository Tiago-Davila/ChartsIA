import { type ReactNode } from 'react';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  titulo: string;
  /** Explica qué pasa al confirmar; la acción destructiva va en `textoConfirmar`. */
  mensaje: ReactNode;
  /** Texto del botón que confirma, por ejemplo "Eliminar". */
  textoConfirmar: string;
  onConfirmar(): void;
  onCerrar(): void;
}

/** Ventana de confirmación: Cancelar tiene el foco al abrir, Escape y el fondo cancelan. */
export function ConfirmDialog({ titulo, mensaje, textoConfirmar, onConfirmar, onCerrar }: ConfirmDialogProps) {
  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="modal__form">
        <p className="modal__text">{mensaje}</p>
        <div className="modal__actions">
          <button type="button" className="button" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="button button--danger" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
}
