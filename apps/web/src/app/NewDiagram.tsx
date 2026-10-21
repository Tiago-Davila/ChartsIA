import { useState, type FormEvent } from 'react';
import { type DiagramType } from '@chartsia/core/model';
import { type Project } from '../state/api-client';
import { DIAGRAM_TYPE_LABELS } from './labels';

export interface NewDiagramProps {
  projects: Project[];
  /** Crea un diagrama vacío; `projectId` es `undefined` si va sin proyecto. */
  onCreate(type: DiagramType, title: string, projectId?: string): void;
}

const TIPOS = Object.entries(DIAGRAM_TYPE_LABELS) as [DiagramType, string][];

/** Botón "Nuevo diagrama" que despliega un formulario con tipo, título y, si hay, proyecto. */
export function NewDiagram({ projects, onCreate }: NewDiagramProps) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<DiagramType>('class');
  const [titulo, setTitulo] = useState('');
  const [proyecto, setProyecto] = useState('');

  const cerrar = () => {
    setAbierto(false);
    setTitulo('');
    setProyecto('');
  };

  // Un título vacío no llama al hub; el título se recorta a 120 caracteres.
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = titulo.trim().slice(0, 120);
    if (!limpio) return;
    onCreate(tipo, limpio, proyecto || undefined);
    cerrar();
  };

  if (!abierto) {
    return (
      <button type="button" className="button button--primary new-diagram__open" onClick={() => setAbierto(true)}>
        Nuevo diagrama
      </button>
    );
  }

  return (
    <form className="new-diagram" aria-label="Nuevo diagrama" onSubmit={enviar} onKeyDown={(e) => e.key === 'Escape' && cerrar()}>
      <label>
        Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as DiagramType)}>
          {TIPOS.map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Título
        <input type="text" value={titulo} maxLength={120} autoFocus onChange={(e) => setTitulo(e.target.value)} />
      </label>
      {projects.length > 0 ? (
        <label>
          Proyecto
          <select value={proyecto} onChange={(e) => setProyecto(e.target.value)}>
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="new-diagram__actions">
        <button type="submit" className="button button--primary" disabled={!titulo.trim()}>
          Crear
        </button>
        <button type="button" className="button" onClick={cerrar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
