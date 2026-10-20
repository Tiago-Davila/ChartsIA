import { Inject, Injectable } from '@nestjs/common';
import { layoutDiagram, relayoutDiagram } from '@chartsia/core/layout';
import { type Diagram, DiagramInputSchema, newDiagramId } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { DomainValidationError, validateDiagram, validationError } from '@chartsia/core/validation';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DiagramEvents, type Origin } from './diagram-events.js';
import { DiagramHistory, type HistoryDirection } from './diagram-history.js';
import { DiagramQueryService, notFound } from './diagram-query.service.js';
import { DiagramLock } from './persistence/diagram-lock.js';
import { DIAGRAM_REPOSITORY, type DiagramRepository } from './persistence/diagram.repository.js';
import { CLOCK, type Clock, DIAGRAM_ID_GENERATOR, type IdGenerator } from './tokens.js';

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
    @Inject(CLOCK) private readonly clock: Clock = () => new Date(),
    @Inject(DIAGRAM_ID_GENERATOR) private readonly newId: IdGenerator = newDiagramId,
  ) {}

  async create(input: unknown): Promise<CommandResult> {
    const checked = validateDiagram(input, { schema: DiagramInputSchema, maxElements: this.config.maxElements });
    if (!checked.ok) throw new DomainValidationError(checked.errors);
    const now = this.clock().toISOString();
    const diagram = await layoutDiagram({
      ...checked.value,
      id: this.newId(),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.save(diagram);
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

      const warnings: string[] = [];
      if (params.baseRevision !== undefined && params.baseRevision !== current.revision) {
        warnings.push(
          `baseRevision ${params.baseRevision} no coincide con la revision actual ${current.revision}: los cambios se aplicaron sobre la versión más reciente (último cambio gana).`,
        );
      }
      const laid = await relayoutDiagram(current, result.diagram);
      warnings.push(...laid.warnings);
      const diagram: Diagram = { ...laid.diagram, revision: current.revision + 1, updatedAt: this.clock().toISOString() };
      await this.repo.save(diagram);
      this.history.record(current);
      this.events.emit({ name: 'diagram.updated', payload: { diagramId: id, revision: diagram.revision, origin: params.origin, diagram } });
      return { diagram, warnings, applied: result.applied };
    });
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
}
