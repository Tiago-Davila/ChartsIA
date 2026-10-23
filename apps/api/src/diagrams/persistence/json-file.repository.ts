import { randomBytes } from 'node:crypto';
import * as fsp from 'node:fs/promises';
import { join } from 'node:path';
import { type Diagram, DiagramSchema, isDiagramId, isProjectId, type Project, ProjectSchema } from '@chartsia/core/model';
import { type DiagramRepository, type DiagramSummary, sortSummaries, summarize } from './diagram.repository.js';

interface IndexFile {
  version: 1;
  activeDiagramId: string | null;
  diagrams: DiagramSummary[];
  /** Ausente en los índices anteriores a los proyectos. */
  projects?: Project[];
}

export interface FsOps {
  writeFile: typeof fsp.writeFile;
  rename: (from: string, to: string) => Promise<void>;
}

export interface WarnLogger {
  warn(message: string): void;
}

const INDEX_FILE = 'index.json';

/**
 * Un archivo `<id>.json` por diagrama más `index.json` con resúmenes y diagrama activo.
 * Toda escritura es atómica (archivo temporal + rename). El índice es reconstruible.
 */
export class JsonFileDiagramRepository implements DiagramRepository {
  private summaries = new Map<string, DiagramSummary>();
  private projects = new Map<string, Project>();
  private activeId: string | null = null;
  private readonly fs: FsOps;

  constructor(
    private readonly dir: string,
    private readonly logger: WarnLogger,
    fs: Partial<FsOps> = {},
  ) {
    this.fs = { writeFile: fsp.writeFile, rename: fsp.rename, ...fs };
  }

  async init(): Promise<void> {
    await fsp.mkdir(this.dir, { recursive: true });
    const index = await this.readIndex();
    if (index) {
      this.summaries = new Map(index.diagrams.map((s) => [s.diagramId, s]));
      const projects = (index.projects ?? []).filter((p) => ProjectSchema.safeParse(p).success);
      this.projects = new Map(projects.map((p) => [p.id, p]));
      // Un diagrama no puede apuntar a un proyecto que ya no existe.
      for (const s of this.summaries.values()) if (s.projectId && !this.projects.has(s.projectId)) delete s.projectId;
      this.activeId = index.activeDiagramId && this.summaries.has(index.activeDiagramId) ? index.activeDiagramId : null;
    } else {
      await this.rebuildIndex();
    }
  }

  async get(id: string): Promise<Diagram | undefined> {
    if (!isDiagramId(id)) return undefined;
    return this.readDiagram(join(this.dir, `${id}.json`));
  }

  async save(diagram: Diagram): Promise<void> {
    if (!isDiagramId(diagram.id)) throw new Error(`id de diagrama inválido: ${diagram.id}`);
    await this.writeAtomic(`${diagram.id}.json`, JSON.stringify(diagram, null, 2));
    const projectId = this.summaries.get(diagram.id)?.projectId;
    this.summaries.set(diagram.id, projectId ? { ...summarize(diagram), projectId } : summarize(diagram));
    await this.writeIndex();
  }

  /** Quita el resumen antes que el archivo: un fallo a medio camino no deja diagramas listados sin contenido. */
  async delete(id: string): Promise<void> {
    if (!isDiagramId(id) || !this.summaries.delete(id)) return;
    if (this.activeId === id) this.activeId = null;
    await this.writeIndex();
    await fsp.rm(join(this.dir, `${id}.json`), { force: true });
  }

  async listProjects(): Promise<Project[]> {
    return structuredClone([...this.projects.values()]);
  }

  async saveProject(project: Project): Promise<void> {
    if (!isProjectId(project.id)) throw new Error(`id de proyecto inválido: ${project.id}`);
    this.projects.set(project.id, ProjectSchema.parse(project));
    await this.writeIndex();
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.projects.delete(id)) return;
    for (const s of this.summaries.values()) if (s.projectId === id) delete s.projectId;
    await this.writeIndex();
  }

  async setDiagramProject(diagramId: string, projectId: string | null): Promise<void> {
    const summary = this.summaries.get(diagramId);
    if (!summary) throw new Error(`diagrama inexistente: ${diagramId}`);
    if (projectId !== null && !this.projects.has(projectId)) throw new Error(`proyecto inexistente: ${projectId}`);
    if (projectId === null) delete summary.projectId;
    else summary.projectId = projectId;
    await this.writeIndex();
  }

  async list(): Promise<DiagramSummary[]> {
    return sortSummaries([...this.summaries.values()]);
  }

  async getActiveId(): Promise<string | null> {
    return this.activeId;
  }

  async setActiveId(id: string | null): Promise<void> {
    if (id !== null && !isDiagramId(id)) throw new Error(`id de diagrama inválido: ${id}`);
    this.activeId = id;
    await this.writeIndex();
  }

  private async readIndex(): Promise<IndexFile | undefined> {
    try {
      const raw = JSON.parse(await fsp.readFile(join(this.dir, INDEX_FILE), 'utf8')) as IndexFile;
      if (raw?.version !== 1 || !Array.isArray(raw.diagrams)) throw new Error('formato desconocido');
      return raw;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`index.json ilegible, se reconstruye: ${(error as Error).message}`);
      }
      return undefined;
    }
  }

  private async rebuildIndex(): Promise<void> {
    const files = (await fsp.readdir(this.dir)).filter((f) => /^dg_[a-z2-7]{12}\.json$/.test(f)).sort();
    this.summaries.clear();
    for (const file of files) {
      const diagram = await this.readDiagram(join(this.dir, file));
      if (diagram) this.summaries.set(diagram.id, summarize(diagram));
    }
    this.activeId = sortSummaries([...this.summaries.values()])[0]?.diagramId ?? null;
    await this.writeIndex();
  }

  private async readDiagram(path: string): Promise<Diagram | undefined> {
    let text: string;
    try {
      text = await fsp.readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
    try {
      // Los diagramas guardados antes de quitar el estilo boceto traen un campo `style` obsoleto.
      const { style: _legacyStyle, ...stored } = JSON.parse(text) as Record<string, unknown>;
      const parsed = DiagramSchema.safeParse(stored);
      if (parsed.success) return parsed.data;
      this.logger.warn(`Se ignora ${path}: no cumple el esquema (${parsed.error.issues[0]?.message ?? ''})`);
    } catch (error) {
      this.logger.warn(`Se ignora ${path}: JSON inválido (${(error as Error).message})`);
    }
    return undefined;
  }

  private writeIndex(): Promise<void> {
    const index: IndexFile = {
      version: 1,
      activeDiagramId: this.activeId,
      diagrams: sortSummaries([...this.summaries.values()]),
      projects: [...this.projects.values()],
    };
    return this.writeAtomic(INDEX_FILE, JSON.stringify(index, null, 2));
  }

  private async writeAtomic(name: string, content: string): Promise<void> {
    const target = join(this.dir, name);
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await this.fs.writeFile(tmp, content, { encoding: 'utf8', mode: 0o600 });
    try {
      await this.fs.rename(tmp, target);
    } catch (error) {
      await fsp.rm(tmp, { force: true });
      throw error;
    }
  }
}
