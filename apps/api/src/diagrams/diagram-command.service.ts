import { Inject, Injectable } from '@nestjs/common';
import { type ExportPreferences } from '@chartsia/core/export';
import { layoutDiagram, relayoutDiagram } from '@chartsia/core/layout';
import { type Diagram, DiagramInputSchema, newDiagramId, newProjectId, type Preferences, type Project, ProjectSchema, styleElement, styleRelation, withPreferences } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { checkRelationsByType, DomainValidationError, fromZodError, validateDiagram, validationError } from '@chartsia/core/validation';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { type BackupImportResult, BackupSchema, type ConflictPolicy } from './backup.js';
import { DiagramEvents, type Origin } from './diagram-events.js';
import { DiagramHistory, type HistoryDirection } from './diagram-history.js';
import { DiagramQueryService, notFound, projectNotFound } from './diagram-query.service.js';
import { DiagramLock } from './persistence/diagram-lock.js';
import { DIAGRAM_REPOSITORY, type DiagramRepository } from './persistence/diagram.repository.js';
import { PreferencesService } from './preferences.service.js';
import { CLOCK, type Clock, DIAGRAM_ID_GENERATOR, type IdGenerator } from './tokens.js';

const PROJECTS_KEY = 'projects';

export interface ApplyParams {
  diagramId?: string;
  baseRevision?: number;
  operations: unknown;
  origin: Origin;
}

export interface CommandResult {
  diagram: Diagram;
  warnings: string[];
}

/** A lo que agregó un cambio le suma el estilo de las preferencias con que se creó el diagrama. */
function styleAdded(before: Diagram, after: Diagram): Diagram {
  const prefs = before.preferences;
  if (!prefs) return after;
  const elementIds = new Set(before.elements.map((e) => e.id));
  const relationIds = new Set(before.relations.map((r) => r.id));
  return {
    ...after,
    elements: after.elements.map((el) => (elementIds.has(el.id) ? el : styleElement(el, prefs))),
    relations: after.relations.map((rel) => (relationIds.has(rel.id) ? rel : styleRelation(rel, prefs))),
  };
}

/**
 * Única ruta de escritura de diagramas para MCP y la app (principio I): valida, dispone,
 * persiste y emite eventos. No conoce transportes ni construye URLs.
 */
@Injectable()
export class DiagramCommandService {
  private readonly history = new DiagramHistory();

  constructor(
    @Inject(DIAGRAM_REPOSITORY) private readonly repo: DiagramRepository,
    private readonly lock: DiagramLock,
    private readonly events: DiagramEvents,
    private readonly query: DiagramQueryService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly preferences: PreferencesService,
    @Inject(CLOCK) private readonly clock: Clock = () => new Date(),
    @Inject(DIAGRAM_ID_GENERATOR) private readonly newId: IdGenerator = newDiagramId,
  ) {}

  /** Con origin "agent" las relaciones deben corresponder al tipo del diagrama; las importaciones y la app no se restringen. */
  async create(input: unknown, projectId?: string, origin?: Origin): Promise<CommandResult> {
    if (projectId !== undefined) await this.requireProject(projectId);
    const checked = validateDiagram(input, { schema: DiagramInputSchema, maxElements: this.config.maxElements });
    if (!checked.ok) throw new DomainValidationError(checked.errors);
    if (origin === 'agent') {
      const typeErrors = checkRelationsByType(checked.value);
      if (typeErrors.length > 0) throw new DomainValidationError(typeErrors);
    }
    const now = this.clock().toISOString();
    const diagram = await layoutDiagram({
      ...withPreferences(checked.value, await this.preferences.get()),
      id: this.newId(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.save(diagram);
    if (projectId !== undefined) await this.repo.setDiagramProject(diagram.id, projectId);
    await this.repo.setActiveId(diagram.id);
    this.events.emit({ name: 'diagram.created', payload: { diagramId: diagram.id, title: diagram.title, type: diagram.type } });
    this.events.emit({ name: 'active.changed', payload: { diagramId: diagram.id } });
    return { diagram, warnings: [] };
  }

  async apply(params: ApplyParams): Promise<CommandResult & { applied: number }> {
    const id = await this.query.resolveId(params.diagramId);
    return this.lock.run(id, async () => {
      const current = await this.repo.get(id);
      if (!current) throw notFound(id);
      const result = applyOperations(current, params.operations, { maxElements: this.config.maxElements });
      if (!result.ok) throw new DomainValidationError(result.errors);
      if (params.origin === 'agent') {
        const typeErrors = checkRelationsByType(result.diagram, current);
        if (typeErrors.length > 0) throw new DomainValidationError(typeErrors);
      }

      const warnings: string[] = [];
      if (params.baseRevision !== undefined && params.baseRevision !== current.revision) {
        warnings.push(
          `baseRevision ${params.baseRevision} no coincide con la revision actual ${current.revision}: los cambios se aplicaron sobre la versión más reciente (último cambio gana).`,
        );
      }
      const laid = await relayoutDiagram(current, styleAdded(current, result.diagram));
      warnings.push(...laid.warnings);
      const diagram: Diagram = { ...laid.diagram, revision: current.revision + 1, updatedAt: this.clock().toISOString() };
      await this.repo.save(diagram);
      this.history.record(current);
      this.events.emit({ name: 'diagram.updated', payload: { diagramId: id, revision: diagram.revision, origin: params.origin, diagram } });
      return { diagram, warnings, applied: result.applied };
    });
  }

  /** Preferencias de diagrama que se aplican a los diagramas nuevos. */
  getPreferences(): Promise<Preferences> {
    return this.preferences.get();
  }

  /** Cambia las preferencias; los diagramas que ya existen no se tocan. */
  setPreferences(changes: unknown): Promise<Preferences> {
    return this.preferences.update(changes);
  }

  /** Preferencias de exportación: formato por defecto, fondo, margen, escala y título. */
  getExportPreferences(): Promise<ExportPreferences> {
    return this.preferences.getExport();
  }

  /** Cambia las preferencias de exportación; valen para las exportaciones siguientes. */
  setExportPreferences(changes: unknown): Promise<ExportPreferences> {
    return this.preferences.updateExport(changes);
  }

  /** Deshace o rehace el último cambio del diagrama, venga del agente o de la app. */
  async undo(params: { diagramId?: string; direction: HistoryDirection; origin: Origin }): Promise<Diagram> {
    const id = await this.query.resolveId(params.diagramId);
    return this.lock.run(id, async () => {
      const current = await this.repo.get(id);
      if (!current) throw notFound(id);
      const target = this.history.step(current, params.direction);
      if (!target) {
        const what = params.direction === 'undo' ? 'deshacer' : 'rehacer';
        throw new DomainValidationError([
          validationError('NOTHING_TO_UNDO', '/direction', `No hay cambios para ${what} en "${current.title}".`, 'La historia solo cubre los cambios hechos desde que arrancó el hub.'),
        ]);
      }
      const diagram: Diagram = { ...current, ...target, revision: current.revision + 1, updatedAt: this.clock().toISOString() };
      await this.repo.save(diagram);
      this.events.emit({ name: 'diagram.updated', payload: { diagramId: id, revision: diagram.revision, origin: params.origin, diagram } });
      return diagram;
    });
  }

  async activate(diagramId: string): Promise<void> {
    if (!(await this.repo.get(diagramId))) throw notFound(diagramId);
    await this.repo.setActiveId(diagramId);
    this.events.emit({ name: 'active.changed', payload: { diagramId } });
  }

  /** Borra un diagrama con su historial de deshacer; las apps que lo tengan abierto vuelven a la lista. */
  deleteDiagram(diagramId: string): Promise<void> {
    return this.lock.run(diagramId, async () => {
      if (!(await this.repo.get(diagramId))) throw notFound(diagramId);
      await this.repo.delete(diagramId);
      this.history.forget(diagramId);
      this.events.emit({ name: 'diagram.deleted', payload: { diagramId } });
    });
  }

  /** Crea un proyecto con ese nombre (se guarda como texto, sin interpretar). */
  createProject(name: unknown): Promise<Project> {
    return this.lock.run(PROJECTS_KEY, async () => {
      const project = this.parseProject({ id: newProjectId(), name, createdAt: this.clock().toISOString() });
      await this.repo.saveProject(project);
      await this.emitProjects();
      return project;
    });
  }

  /** Cambia el nombre de un proyecto existente. */
  renameProject(projectId: string, name: unknown): Promise<Project> {
    return this.lock.run(PROJECTS_KEY, async () => {
      const project = this.parseProject({ ...(await this.requireProject(projectId)), name });
      await this.repo.saveProject(project);
      await this.emitProjects();
      return project;
    });
  }

  /** Borra un proyecto; sus diagramas quedan sin proyecto. */
  deleteProject(projectId: string): Promise<void> {
    return this.lock.run(PROJECTS_KEY, async () => {
      await this.requireProject(projectId);
      await this.repo.deleteProject(projectId);
      await this.emitProjects();
    });
  }

  /** Mueve un diagrama a un proyecto o lo saca con `null`. */
  moveDiagram(diagramId: string, projectId: string | null): Promise<void> {
    return this.lock.run(PROJECTS_KEY, async () => {
      if (!(await this.repo.get(diagramId))) throw notFound(diagramId);
      if (projectId !== null) await this.requireProject(projectId);
      await this.repo.setDiagramProject(diagramId, projectId);
      await this.emitProjects();
    });
  }

  /**
   * Importa un respaldo todo o nada. Los proyectos que ya existen se conservan; un diagrama con
   * un id que ya existe obliga a elegir `replace` o `skip`, y sin esa elección no se escribe nada.
   */
  importBackup(input: unknown, onConflict?: ConflictPolicy): Promise<BackupImportResult> {
    return this.lock.run(PROJECTS_KEY, async () => {
      const parsed = BackupSchema.safeParse(input);
      if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error, '/backup'));
      const backup = parsed.data;
      const existing = new Map((await this.repo.list()).map((s) => [s.diagramId, s]));
      const conflicts = backup.diagrams.flatMap(({ diagram }, i) => {
        const current = existing.get(diagram.id);
        return current
          ? [validationError('IMPORT_CONFLICT', `/backup/diagrams/${i}/diagram/id`, `El diagrama "${diagram.id}" ya existe como "${current.title}" (en el archivo se llama "${diagram.title}").`, 'Vuelve a importar con onConflict "replace" para reemplazarlo o "skip" para dejar el actual.')]
          : [];
      });
      if (conflicts.length > 0 && !onConflict) throw new DomainValidationError(conflicts);

      const result: BackupImportResult = { imported: 0, replaced: 0, skipped: 0, projectsCreated: 0 };
      const undo: (() => Promise<void>)[] = [];
      const known = new Set((await this.repo.listProjects()).map((p) => p.id));
      const saved: { diagram: Diagram; replaced: boolean }[] = [];
      try {
        for (const project of backup.projects.filter((p) => !known.has(p.id))) {
          await this.repo.saveProject(project);
          undo.push(() => this.repo.deleteProject(project.id));
          result.projectsCreated++;
        }
        for (const { diagram, projectId } of backup.diagrams) {
          const current = existing.get(diagram.id);
          if (current && onConflict === 'skip') {
            result.skipped++;
            continue;
          }
          const before = current ? await this.repo.get(diagram.id) : undefined;
          // Un diagrama reemplazado sube de revisión para que las apps abiertas lo recarguen.
          const written = before ? { ...diagram, revision: Math.max(diagram.revision, before.revision) + 1 } : diagram;
          await this.repo.save(written);
          undo.push(before ? () => this.repo.save(before) : () => this.repo.delete(diagram.id));
          if (before) undo.push(() => this.repo.setDiagramProject(diagram.id, current?.projectId ?? null));
          await this.repo.setDiagramProject(diagram.id, projectId ?? null);
          saved.push({ diagram: written, replaced: before !== undefined });
          if (before) result.replaced++;
          else result.imported++;
        }
      } catch (error) {
        for (const step of undo.reverse()) await step().catch(() => undefined);
        throw error;
      }

      for (const { diagram, replaced } of saved) {
        if (replaced) {
          this.history.forget(diagram.id);
          this.events.emit({ name: 'diagram.updated', payload: { diagramId: diagram.id, revision: diagram.revision, origin: 'app', diagram } });
        } else {
          this.events.emit({ name: 'diagram.created', payload: { diagramId: diagram.id, title: diagram.title, type: diagram.type } });
        }
      }
      await this.emitProjects();
      return result;
    });
  }

  private parseProject(candidate: unknown): Project {
    const parsed = ProjectSchema.safeParse(candidate);
    if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
    return parsed.data;
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = (await this.repo.listProjects()).find((p) => p.id === projectId);
    if (!project) throw projectNotFound(projectId);
    return project;
  }

  private async emitProjects(): Promise<void> {
    this.events.emit({ name: 'projects.changed', payload: { projects: await this.repo.listProjects() } });
  }
}
