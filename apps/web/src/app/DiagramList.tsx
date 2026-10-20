import { useState } from 'react';
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

/** Barra lateral con todos los diagramas (FR-025); el activo de los agentes va marcado. */
export function DiagramList({ diagrams, activeDiagramId, openDiagramId, onOpen }: DiagramListProps) {
  const [busqueda, setBusqueda] = useState('');
  const visibles = filtrarDiagramas(diagrams, busqueda);
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
      {visibles.length === 0 ? (
        <p className="diagram-list__empty">{diagrams.length === 0 ? 'Aún no hay diagramas.' : 'Sin resultados.'}</p>
      ) : (
        <ul>
          {visibles.map((d) => (
            <li key={d.diagramId}>
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
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
