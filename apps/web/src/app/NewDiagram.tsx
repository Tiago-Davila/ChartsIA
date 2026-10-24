import { useState, type FormEvent } from 'react';
import { type DiagramType } from '@chartsia/core/model';
import { type Project } from '../state/api-client';
import { GlideMenu } from './GlideMenu';
import { CodeIcon, FileIcon, PlusIcon } from './icons';
import { DIAGRAM_TYPE_LABELS } from './labels';
import { Modal } from './Modal';

export interface NewDiagramProps {
  projects: Project[];
  /** Crea un diagrama vacío; `projectId` es `undefined` si va sin proyecto. */
  onCreate(type: DiagramType, title: string, projectId?: string): void;
  onImportMermaid(source: string, title?: string, projectId?: string): Promise<string[] | null>;
}

const TIPOS = Object.entries(DIAGRAM_TYPE_LABELS) as [DiagramType, string][];

type Opcion = 'diagrama' | 'mermaid';

const OPCIONES = [
  { value: 'diagrama' as const, label: 'Diagrama en blanco', icon: <FileIcon /> },
  { value: 'mermaid' as const, label: 'Importar Mermaid', icon: <CodeIcon /> },
];

/** Botón "+ Nuevo" con un menú que abre, en una ventana, el formulario de diagrama en blanco o el de importar Mermaid. */
export function NewDiagram({ projects, onCreate, onImportMermaid }: NewDiagramProps) {
  const [abierto, setAbierto] = useState(false);
  const [importando, setImportando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [avisosImportacion, setAvisosImportacion] = useState<string[]>([]);
  const [tipo, setTipo] = useState<DiagramType>('class');
  const [titulo, setTitulo] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [mermaid, setMermaid] = useState('');

  const cerrar = () => {
    setAbierto(false);
    setImportando(false);
    setEnviando(false);
    setAvisosImportacion([]);
    setTitulo('');
    setProyecto('');
    setMermaid('');
  };

  // Un título vacío no llama al hub; el título se recorta a 120 caracteres.
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = titulo.trim().slice(0, 120);
    if (!limpio) return;
    onCreate(tipo, limpio, proyecto || undefined);
    cerrar();
  };

  const importar = async (e: FormEvent) => {
    e.preventDefault();
    const source = mermaid;
    if (!source.trim() || enviando) return;
    setAvisosImportacion([]);
    setEnviando(true);
    try {
      const avisos = await onImportMermaid(source, titulo.trim() || undefined, proyecto || undefined);
      if (avisos === null) return;
      if (avisos.length) setAvisosImportacion(avisos);
      else cerrar();
    } finally {
      setEnviando(false);
    }
  };

  const selectorProyecto = (deshabilitado: boolean) =>
    projects.length > 0 ? (
      <label>
        Proyecto
        <select value={proyecto} disabled={deshabilitado} onChange={(e) => setProyecto(e.target.value)}>
          <option value="">Sin proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <>
      <GlideMenu<Opcion>
        className="sidebar-nav__new"
        ariaLabel="Nuevo"
        label={<><PlusIcon /> Nuevo</>}
        items={OPCIONES}
        onSelect={(opcion) => (opcion === 'diagrama' ? setAbierto(true) : setImportando(true))}
      />
      {abierto ? (
        <Modal titulo="Nuevo diagrama" onCerrar={cerrar}>
          <form className="new-diagram" aria-label="Nuevo diagrama" onSubmit={enviar}>
            <label>
              Título
              <input type="text" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
            </label>
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
            {selectorProyecto(false)}
            <div className="new-diagram__actions">
              <button type="button" className="button" onClick={cerrar}>
                Cancelar
              </button>
              <button type="submit" className="button button--primary" disabled={!titulo.trim()}>
                Crear
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {importando ? (
        <Modal titulo="Importar Mermaid" onCerrar={cerrar}>
          <form className="new-diagram" aria-label="Importar Mermaid" onSubmit={importar}>
            <label>
              Mermaid classDiagram
              <textarea aria-label="Mermaid classDiagram" value={mermaid} rows={8} maxLength={256 * 1024} disabled={enviando} onChange={(e) => setMermaid(e.target.value)} placeholder={'classDiagram\n  class Usuario'} />
            </label>
            <label>
              Título (opcional)
              <input type="text" value={titulo} maxLength={120} disabled={enviando} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            {selectorProyecto(enviando)}
            <p className="new-diagram__hint">Máximo 256 Ki caracteres. Las directivas visuales se omiten; los enlaces y callbacks no se ejecutan.</p>
            {avisosImportacion.length > 0 ? (
              <div className="new-diagram__import-warnings" role="status" aria-live="polite">
                <strong>Diagrama importado con aproximaciones</strong>
                <ul aria-label="Avisos de importación">{avisosImportacion.map((aviso, index) => <li key={index}>{aviso}</li>)}</ul>
              </div>
            ) : null}
            <div className="new-diagram__actions">
              {avisosImportacion.length > 0 ? (
                <button type="button" className="button" onClick={cerrar}>Listo</button>
              ) : (
                <button type="button" className="button" disabled={enviando} onClick={cerrar}>Cancelar</button>
              )}
              <button type="submit" className="button button--primary" disabled={!mermaid.trim() || enviando || avisosImportacion.length > 0}>
                {enviando ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
