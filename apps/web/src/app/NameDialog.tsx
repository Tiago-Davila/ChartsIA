import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

export interface NameDialogProps {
  titulo: string;
  /** Texto del botón que confirma, por ejemplo "Crear" o "Renombrar". */
  textoConfirmar: string;
  valorInicial?: string;
  maxLength?: number;
  /** Recibe el nombre sin espacios sobrantes; nunca se llama con un nombre vacío. */
  onConfirmar(nombre: string): void;
  onCerrar(): void;
}

/** Ventana con un campo de nombre: Enter confirma, Escape cancela y un nombre vacío no se acepta. */
export function NameDialog({ titulo, textoConfirmar, valorInicial = '', maxLength, onConfirmar, onCerrar }: NameDialogProps) {
  const [nombre, setNombre] = useState(valorInicial);
  const limpio = nombre.trim();

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (limpio) onConfirmar(limpio);
  };

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <form className="modal__form" onSubmit={enviar}>
        <label className="modal__field">
          Nombre
          <input type="text" value={nombre} maxLength={maxLength} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <div className="modal__actions">
          <button type="button" className="button" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="button button--primary" disabled={!limpio}>
            {textoConfirmar}
          </button>
        </div>
      </form>
    </Modal>
  );
}
