import { type Diagram, type Project } from '@chartsia/core/model';
import { type DiagramRepository, type DiagramSummary, sortSummaries, summarize } from './diagram.repository.js';

/** Repositorio en memoria para tests y ejecuciones efímeras. */
export class InMemoryDiagramRepository implements DiagramRepository {
  private readonly diagrams = new Map<string, Diagram>();
  private readonly projects = new Map<string, Project>();
  private readonly projectOf = new Map<string, string>();
  private activeId: string | null = null;

  async get(id: string): Promise<Diagram | undefined> {
    const d = this.diagrams.get(id);
    return d ? structuredClone(d) : undefined;
  }

  async save(diagram: Diagram): Promise<void> {
    this.diagrams.set(diagram.id, structuredClone(diagram));
  }

  async delete(id: string): Promise<void> {
    this.diagrams.delete(id);
    this.projectOf.delete(id);
    if (this.activeId === id) this.activeId = null;
  }

  async list(): Promise<DiagramSummary[]> {
    return sortSummaries(
      [...this.diagrams.values()].map((d) => {
        const projectId = this.projectOf.get(d.id);
        return projectId ? { ...summarize(d), projectId } : summarize(d);
      }),
    );
  }

  async getActiveId(): Promise<string | null> {
    return this.activeId;
  }

  async setActiveId(id: string | null): Promise<void> {
    this.activeId = id;
  }

  async listProjects(): Promise<Project[]> {
    return structuredClone([...this.projects.values()]);
  }

  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.id, structuredClone(project));
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
    for (const [diagramId, projectId] of this.projectOf) if (projectId === id) this.projectOf.delete(diagramId);
  }

  async setDiagramProject(diagramId: string, projectId: string | null): Promise<void> {
    if (projectId === null) this.projectOf.delete(diagramId);
    else if (this.projects.has(projectId)) this.projectOf.set(diagramId, projectId);
    else throw new Error(`proyecto inexistente: ${projectId}`);
  }
}
