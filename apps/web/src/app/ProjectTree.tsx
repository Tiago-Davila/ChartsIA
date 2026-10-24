import { type ReactNode } from 'react';
import { type DiagramListItem } from './DiagramList';
import { ChevronIcon } from './icons';

// Adaptado de BranchedMenu de React Bits: cada proyecto se pliega y sus diagramas cuelgan de un tronco con ramas curvas.

export interface ProjectTreeSection {
  id: string;
  nombre: string;
  diagramas: DiagramListItem[];
}

export interface ProjectTreeProps {
  secciones: ProjectTreeSection[];
  /** Devuelve si el proyecto se muestra desplegado. */
  abierta(id: string): boolean;
  openDiagramId: string | null;
  onToggle(id: string): void;
  onOpen(diagramId: string): void;
  /** Menú ⋯ que va al lado del nombre del proyecto. */
  menu(seccion: ProjectTreeSection): ReactNode;
}

const ROW = 32;
const PAD = 4;
const TRUNK = 13;
const INDENT = 34;
const RADIUS = 8;

const rowY = (k: number) => PAD + k * ROW + ROW / 2;
const r = Math.min(RADIUS, ROW / 2 - 2);
const endX = INDENT - 8;
/** Rama fija desde el tronco hasta la fila k. */
const branch = (k: number) => `M ${TRUNK} ${rowY(k) - r} A ${r} ${r} 0 0 0 ${TRUNK + r} ${rowY(k)} H ${endX}`;
/** Recorrido completo desde arriba del tronco hasta la fila k, que se dibuja en la fila abierta. */
const reach = (k: number) => `M ${TRUNK} 0 V ${rowY(k) - r} A ${r} ${r} 0 0 0 ${TRUNK + r} ${rowY(k)} H ${endX}`;
const length = (k: number) => rowY(k) - r + (Math.PI * r) / 2 + (endX - TRUNK - r);

/** Proyectos plegables con sus diagramas en árbol; la línea hasta el diagrama abierto se dibuja en color. */
export function ProjectTree({ secciones, abierta, openDiagramId, onToggle, onOpen, menu }: ProjectTreeProps) {
  return (
    <ul className="project-tree" aria-label="Proyectos">
      {secciones.map((s) => {
        const isOpen = abierta(s.id);
        const height = PAD * 2 + s.diagramas.length * ROW;
        return (
          <li key={s.id} className="diagram-list__section project-tree__section" data-open={isOpen ? '' : undefined}>
            <div className="diagram-list__section-head">
              <button type="button" className="diagram-list__section-title" aria-expanded={isOpen} onClick={() => onToggle(s.id)}>
                <span className="project-tree__chevron">
                  <ChevronIcon />
                </span>
                <span className="project-tree__name">{s.nombre}</span>
                <span className="diagram-list__count">{s.diagramas.length}</span>
              </button>
              {menu(s)}
            </div>
            {s.diagramas.length > 0 ? (
              <div className="project-tree__body">
                <div className="project-tree__fold">
                  <div className="project-tree__tree" style={{ height }}>
                    <svg className="project-tree__lines" width={INDENT} height={height} aria-hidden="true">
                      <path className="project-tree__base" d={`M ${TRUNK} 0 V ${rowY(s.diagramas.length - 1) - r}`} />
                      {s.diagramas.map((d, k) => (
                        <path key={d.diagramId} className="project-tree__base" d={branch(k)} />
                      ))}
                      {s.diagramas.map((d, k) => (
                        <path key={d.diagramId} className="project-tree__reach" d={reach(k)} style={{ strokeDasharray: length(k), strokeDashoffset: d.diagramId === openDiagramId ? 0 : length(k) }} />
                      ))}
                    </svg>
                    {s.diagramas.map((d) => (
                      <button
                        key={d.diagramId}
                        type="button"
                        className="project-tree__item"
                        title={d.title}
                        aria-current={d.diagramId === openDiagramId ? 'page' : undefined}
                        tabIndex={isOpen ? 0 : -1}
                        onClick={() => onOpen(d.diagramId)}
                      >
                        <span className="project-tree__label">{d.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
