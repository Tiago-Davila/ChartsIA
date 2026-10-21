import { Inject, Injectable } from '@nestjs/common';
import { type Diagram, type Project } from '@chartsia/core/model';
import { DomainValidationError, validationError } from '@chartsia/core/validation';
import { DIAGRAM_REPOSITORY, type DiagramRepository, type DiagramSummary } from './persistence/diagram.repository.js';

export interface DiagramList {
  activeDiagramId: string | null;
  diagrams: DiagramSummary[];
  projects: Project[];
}

export function notFound(diagramId: string): DomainValidationError {
  return new DomainValidationError([
    validationError(
      'DIAGRAM_NOT_FOUND',
      '/diagramId',
      `No existe el diagrama "${diagramId}".`,
      'Usa list_diagrams para ver los ids disponibles u omite diagramId para usar el diagrama activo.',
    ),
  ]);
}

export function projectNotFound(projectId: string): DomainValidationError {
  return new DomainValidationError([
    validationError(
      'PROJECT_NOT_FOUND',
      '/projectId',
      `No existe el proyecto "${projectId}".`,
      'Usa list_diagrams para ver los proyectos disponibles o crea uno con create_project.',
    ),
  ]);
}

/** Lecturas de diagramas (get, list) y resolución del diagrama activo. */
@Injectable()
export class DiagramQueryService {
  constructor(@Inject(DIAGRAM_REPOSITORY) private readonly repo: DiagramRepository) {}

  /** Devuelve el id indicado o el activo; nunca un id inexistente. */
  async resolveId(diagramId?: string): Promise<string> {
    if (diagramId !== undefined) return diagramId;
    const active = await this.repo.getActiveId();
    if (active) return active;
    throw new DomainValidationError([
      validationError(
        'NO_ACTIVE_DIAGRAM',
        '/diagramId',
        'No hay diagrama activo.',
        'Crea uno con create_diagram o indica diagramId (consulta list_diagrams).',
      ),
    ]);
  }

  async require(diagramId?: string): Promise<Diagram> {
    const id = await this.resolveId(diagramId);
    const diagram = await this.repo.get(id);
    if (!diagram) throw notFound(id);
    return diagram;
  }

  async get(diagramId?: string, includeLayout = false): Promise<Diagram> {
    const diagram = await this.require(diagramId);
    if (includeLayout) return diagram;
    return {
      ...diagram,
      elements: diagram.elements.map(({ layout: _layout, ...el }) => el),
      relations: diagram.relations.map(({ route: _route, ...rel }) => rel),
    } as Diagram;
  }

  async list(): Promise<DiagramList> {
    return { activeDiagramId: await this.repo.getActiveId(), diagrams: await this.repo.list(), projects: await this.repo.listProjects() };
  }
}
