import { type Diagram } from '@chartsia/core/model';
import { type DiagramRepository, type DiagramSummary, sortSummaries, summarize } from './diagram.repository.js';

/** Repositorio en memoria para tests y ejecuciones efímeras. */
export class InMemoryDiagramRepository implements DiagramRepository {
  private readonly diagrams = new Map<string, Diagram>();
  private activeId: string | null = null;

  async get(id: string): Promise<Diagram | undefined> {
    const d = this.diagrams.get(id);
    return d ? structuredClone(d) : undefined;
  }

  async save(diagram: Diagram): Promise<void> {
    this.diagrams.set(diagram.id, structuredClone(diagram));
  }

  async list(): Promise<DiagramSummary[]> {
    return sortSummaries([...this.diagrams.values()].map(summarize));
  }

  async getActiveId(): Promise<string | null> {
    return this.activeId;
  }

  async setActiveId(id: string | null): Promise<void> {
    this.activeId = id;
  }
}
