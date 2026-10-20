import { type DiagramType } from '@chartsia/core/model';
import { DIAGRAM_TYPE_LABELS, formatDate } from './labels';

export interface DiagramListItem {
  diagramId: string;
  type: DiagramType;
  title: string;
  revision: number;
  updatedAt: string;
}

export interface DiagramListProps {
  diagrams: DiagramListItem[];
  activeDiagramId: string | null;
  openDiagramId: string | null;
  onOpen(diagramId: string): void;
}

/** Barra lateral con todos los diagramas (FR-025); el activo de los agentes va marcado. */
export function DiagramList({ diagrams, activeDiagramId, openDiagramId, onOpen }: DiagramListProps) {
  return (
    <nav className="diagram-list" aria-label="Diagramas">
      <h2 className="diagram-list__title">Diagramas</h2>
      {diagrams.length === 0 ? (
        <p className="diagram-list__empty">Aún no hay diagramas.</p>
      ) : (
        <ul>
          {diagrams.map((d) => (
            <li key={d.diagramId}>
              <button
                type="button"
                className={`diagram-list__item${d.diagramId === openDiagramId ? ' is-open' : ''}`}
                aria-current={d.diagramId === openDiagramId ? 'page' : undefined}
                onClick={() => onOpen(d.diagramId)}
              >
                <span className="diagram-list__name">{d.title}</span>
                <span className="diagram-list__meta">
                  {DIAGRAM_TYPE_LABELS[d.type]} · {formatDate(d.updatedAt)}
                </span>
                {d.diagramId === activeDiagramId ? <span className="badge">Activo</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
