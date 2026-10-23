import { useEffect, useState } from 'react';
import { type DiagramType } from '@chartsia/core/model';
import { type Project } from '../state/api-client';
import { DIAGRAM_TYPE_LABELS, formatDate } from './labels';
import { NameDialog } from './NameDialog';

export interface DiagramListItem {
  diagramId: string;
  type: DiagramType;
  title: string;
  revision: number;
  updatedAt: string;
  projectId?: string;
}

export interface DiagramListProps {
  diagrams: DiagramListItem[];
  projects: Project[];
  activeDiagramId: string | null;
  openDiagramId: string | null;
  onOpen(diagramId: string): void;
  /** Mueve el diagrama a un proyecto, o lo saca de él con `null`. */
  onMove(diagramId: string, projectId: string | null): void;
  /** Crea un proyecto con ese nombre y mueve el diagrama a él. */
  onNewProject(diagramId: string, name: string): void;
  /** Cambia el nombre de un proyecto desde su menú ⋯. */
  onRenameProject(projectId: string, name: string): void;
  /** Cambia el título del diagrama sin abrirlo. */
  onRename(diagramId: string, title: string): void;
}

/** Quita mayúsculas y acentos para comparar títulos. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Filtra por título y ordena por última modificación, el más reciente primero. */
export function filtrarDiagramas(diagramas: DiagramListItem[], busqueda: string): DiagramListItem[] {
  const buscado = normalizar(busqueda.trim());
  return diagramas
    .filter((d) => normalizar(d.title).includes(buscado))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface SeccionDiagramas {
  /** Id del proyecto; `null` es la sección "Sin proyecto". */
  id: string | null;
  nombre: string;
  diagramas: DiagramListItem[];
}

/** Agrupa los diagramas filtrados por proyecto; los de un proyecto desconocido van a "Sin proyecto". */
export function agruparPorProyecto(diagramas: DiagramListItem[], proyectos: Project[], busqueda: string): SeccionDiagramas[] {
  const visibles = filtrarDiagramas(diagramas, busqueda);
  const ids = new Set(proyectos.map((p) => p.id));
  const secciones = proyectos.map((p) => ({ id: p.id as string | null, nombre: p.name, diagramas: visibles.filter((d) => d.projectId === p.id) }));
  secciones.push({ id: null, nombre: 'Sin proyecto', diagramas: visibles.filter((d) => !d.projectId || !ids.has(d.projectId)) });
  // Buscando se ocultan las secciones vacías.
  return busqueda.trim() ? secciones.filter((s) => s.diagramas.length > 0) : secciones;
}

/** Ventana abierta desde un menú ⋯: nombre de un proyecto nuevo, nombre de un proyecto o título de un diagrama. */
type Dialogo =
  | { tipo: 'proyecto'; diagramId: string }
  | { tipo: 'renombrar-proyecto'; projectId: string; nombre: string }
  | { tipo: 'titulo'; diagrama: DiagramListItem };

/** Barra lateral con los diagramas agrupados por proyecto (FR-025); el activo de los agentes va marcado. */
export function DiagramList({ diagrams, projects, activeDiagramId, openDiagramId, onOpen, onMove, onNewProject, onRenameProject, onRename }: DiagramListProps) {
  const [busqueda, setBusqueda] = useState('');
  const [plegadas, setPlegadas] = useState<ReadonlySet<string>>(new Set());
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const visibles = filtrarDiagramas(diagrams, busqueda);
  const secciones = agruparPorProyecto(diagrams, projects, busqueda);

  // Escape o un clic fuera del menú lo cierran.
  useEffect(() => {
    if (menuAbierto === null) return;
    const cerrarConEscape = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(null);
    const cerrarFuera = (e: MouseEvent) => !(e.target as Element).closest('.diagram-list__menu-wrap') && setMenuAbierto(null);
    document.addEventListener('keydown', cerrarConEscape);
    document.addEventListener('mousedown', cerrarFuera);
    return () => {
      document.removeEventListener('keydown', cerrarConEscape);
      document.removeEventListener('mousedown', cerrarFuera);
    };
  }, [menuAbierto]);

  const cerrarDialogo = () => setDialogo(null);

  // Cierra el menú y ejecuta la opción elegida.
  const elegir = (accion: () => void) => {
    setMenuAbierto(null);
    accion();
  };

  const alternar = (clave: string) =>
    setPlegadas((actuales) => {
      const nuevas = new Set(actuales);
      if (!nuevas.delete(clave)) nuevas.add(clave);
      return nuevas;
    });

  const renderItem = (d: DiagramListItem) => {
    const tieneProyecto = d.projectId !== undefined && projects.some((p) => p.id === d.projectId);
    return (
    <li key={d.diagramId} className="diagram-list__row">
      <button
        type="button"
        className={`diagram-list__item${d.diagramId === openDiagramId ? ' is-open' : ''}`}
        aria-current={d.diagramId === openDiagramId ? 'page' : undefined}
        title={d.title}
        onClick={() => onOpen(d.diagramId)}
      >
        <span className="diagram-list__name">{d.title}</span>
        <span className="diagram-list__meta">
          {DIAGRAM_TYPE_LABELS[d.type]} · {formatDate(d.updatedAt)}
        </span>
        {d.diagramId === activeDiagramId ? <span className="badge">Activo</span> : null}
      </button>
      <div className="diagram-list__menu-wrap">
        <button
          type="button"
          className="diagram-list__menu-button"
          aria-label={`Opciones de ${d.title}`}
          aria-haspopup="menu"
          aria-expanded={menuAbierto === d.diagramId}
          onClick={() => setMenuAbierto(menuAbierto === d.diagramId ? null : d.diagramId)}
        >
          ⋯
        </button>
        {menuAbierto === d.diagramId ? (
          <ul role="menu" className="diagram-list__menu">
            <li role="none">
              <button type="button" role="menuitem" onClick={() => elegir(() => setDialogo({ tipo: 'titulo', diagrama: d }))}>
                Renombrar…
              </button>
            </li>
            {projects
              .filter((p) => p.id !== d.projectId)
              .map((p) => (
                <li key={p.id} role="none">
                  <button type="button" role="menuitem" onClick={() => elegir(() => onMove(d.diagramId, p.id))}>
                    Mover a {p.name}
                  </button>
                </li>
              ))}
            <li role="none">
              <button type="button" role="menuitem" onClick={() => elegir(() => setDialogo({ tipo: 'proyecto', diagramId: d.diagramId }))}>
                Nuevo proyecto…
              </button>
            </li>
            {tieneProyecto ? (
              <li role="none">
                <button type="button" role="menuitem" onClick={() => elegir(() => onMove(d.diagramId, null))}>
                  Quitar del proyecto
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </li>
    );
  };

  return (
    <nav className="diagram-list" aria-label="Diagramas">
      <h2 className="diagram-list__title">Diagramas</h2>
      {diagrams.length > 0 ? (
        <input
          type="search"
          className="diagram-list__search"
          aria-label="Buscar diagramas por título"
          placeholder="Buscar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      ) : null}
      {visibles.length === 0 && (diagrams.length === 0 || projects.length === 0 || busqueda.trim()) ? (
        <p className="diagram-list__empty">{diagrams.length === 0 ? 'Aún no hay diagramas.' : 'Sin resultados.'}</p>
      ) : projects.length === 0 ? (
        <ul>{visibles.map(renderItem)}</ul>
      ) : (
        <ul>
          {secciones.map((s) => {
            const clave = s.id ?? 'sin-proyecto';
            // Buscando, las secciones se muestran abiertas para no esconder resultados.
            const abierta = busqueda.trim() !== '' || !plegadas.has(clave);
            // "Sin proyecto" no tiene nombre que cambiar, así que no lleva menú.
            const projectId = s.id;
            const claveMenu = `proyecto:${clave}`;
            return (
              <li key={clave} className="diagram-list__section">
                <div className="diagram-list__section-head">
                  <button type="button" className="diagram-list__section-title" aria-expanded={abierta} onClick={() => alternar(clave)}>
                    <span aria-hidden>{abierta ? '▾' : '▸'}</span> {s.nombre} <span className="diagram-list__count">{s.diagramas.length}</span>
                  </button>
                  {projectId !== null ? (
                    <div className="diagram-list__menu-wrap">
                      <button
                        type="button"
                        className="diagram-list__menu-button"
                        aria-label={`Opciones del proyecto ${s.nombre}`}
                        aria-haspopup="menu"
                        aria-expanded={menuAbierto === claveMenu}
                        onClick={() => setMenuAbierto(menuAbierto === claveMenu ? null : claveMenu)}
                      >
                        ⋯
                      </button>
                      {menuAbierto === claveMenu ? (
                        <ul role="menu" className="diagram-list__menu">
                          <li role="none">
                            <button type="button" role="menuitem" onClick={() => elegir(() => setDialogo({ tipo: 'renombrar-proyecto', projectId, nombre: s.nombre }))}>
                              Renombrar…
                            </button>
                          </li>
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {abierta ? <ul>{s.diagramas.map(renderItem)}</ul> : null}
              </li>
            );
          })}
        </ul>
      )}
      {dialogo?.tipo === 'proyecto' ? (
        <NameDialog
          titulo="Nuevo proyecto"
          textoConfirmar="Crear"
          onCerrar={cerrarDialogo}
          onConfirmar={(nombre) => {
            onNewProject(dialogo.diagramId, nombre);
            cerrarDialogo();
          }}
        />
      ) : null}
      {dialogo?.tipo === 'renombrar-proyecto' ? (
        <NameDialog
          titulo="Renombrar proyecto"
          textoConfirmar="Renombrar"
          valorInicial={dialogo.nombre}
          maxLength={100}
          onCerrar={cerrarDialogo}
          onConfirmar={(nombre) => {
            // Un nombre igual al actual no llama al hub.
            if (nombre !== dialogo.nombre) onRenameProject(dialogo.projectId, nombre);
            cerrarDialogo();
          }}
        />
      ) : null}
      {dialogo?.tipo === 'titulo' ? (
        <NameDialog
          titulo="Renombrar diagrama"
          textoConfirmar="Renombrar"
          valorInicial={dialogo.diagrama.title}
          maxLength={120}
          onCerrar={cerrarDialogo}
          onConfirmar={(titulo) => {
            // Un título igual al actual no llama al hub.
            if (titulo !== dialogo.diagrama.title) onRename(dialogo.diagrama.diagramId, titulo);
            cerrarDialogo();
          }}
        />
      ) : null}
    </nav>
  );
}
