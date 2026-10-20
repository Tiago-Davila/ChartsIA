import { type Diagram, type DiagramType } from '@chartsia/core/model';

export interface DiagramSummary {
  diagramId: string;
  type: DiagramType;
  title: string;
  revision: number;
  updatedAt: string;
}

/** Almacenamiento de diagramas; la escritura siempre pasa por los servicios de aplicación. */
export interface DiagramRepository {
  get(id: string): Promise<Diagram | undefined>;
  save(diagram: Diagram): Promise<void>;
  /** Resúmenes ordenados por `updatedAt` descendente. */
  list(): Promise<DiagramSummary[]>;
  getActiveId(): Promise<string | null>;
  setActiveId(id: string | null): Promise<void>;
}

export const DIAGRAM_REPOSITORY = Symbol('DIAGRAM_REPOSITORY');

export function summarize(d: Diagram): DiagramSummary {
  return { diagramId: d.id, type: d.type, title: d.title, revision: d.revision, updatedAt: d.updatedAt };
}

export function sortSummaries(list: DiagramSummary[]): DiagramSummary[] {
  return [...list].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.diagramId.localeCompare(b.diagramId),
  );
}
