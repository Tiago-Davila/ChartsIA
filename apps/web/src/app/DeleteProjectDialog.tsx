import { HoldButton } from './HoldButton';
import { Modal } from './Modal';

export interface DeleteProjectDialogProps {
  nombre: string;
  /** Cantidad de diagramas del proyecto; pasan a "Sin proyecto" sin borrarse. */
  diagramas: number;
  onConfirmar(): void;
  onCerrar(): void;
}

/** Explica qué pasa con los diagramas del proyecto según cuántos sean. */
export function textoDiagramas(cantidad: number): string {
  if (cantidad === 0) return 'El proyecto no tiene diagramas.';
  if (cantidad === 1) return 'Su diagrama pasa a «Sin proyecto».';
  return `Sus ${cantidad} diagramas pasan a «Sin proyecto».`;
}

/** Advertencia antes de eliminar un proyecto: Cancelar no hace nada y mantener pulsado Eliminar lo borra. */
export function DeleteProjectDialog({ nombre, diagramas, onConfirmar, onCerrar }: DeleteProjectDialogProps) {
  return (
    <Modal titulo="Eliminar proyecto" onCerrar={onCerrar}>
      <p className="modal__text">
        Se elimina el proyecto «{nombre}». {textoDiagramas(diagramas)} Los diagramas no se borran.
      </p>
      <div className="modal__actions">
        <button type="button" className="button" onClick={onCerrar}>
          Cancelar
        </button>
        <HoldButton hint="Mantén pulsado para confirmar" onHold={onConfirmar}>
          Mantener para eliminar
        </HoldButton>
      </div>
    </Modal>
  );
}
