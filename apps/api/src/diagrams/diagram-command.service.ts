import { Inject, Injectable } from '@nestjs/common';
import { layoutDiagram, relayoutDiagram } from '@chartsia/core/layout';
import { type Diagram, DiagramInputSchema, newDiagramId } from '@chartsia/core/model';
import { applyOperations } from '@chartsia/core/operations';
import { DomainValidationError, validateDiagram } from '@chartsia/core/validation';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DiagramEvents, type Origin } from './diagram-events.js';
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
      style: checked.value.style ?? 'clean',
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
      this.events.emit({ name: 'diagram.updated', payload: { diagramId: id, revision: diagram.revision, origin: params.origin, diagram } });
      return { diagram, warnings, applied: result.applied };
    });
  }

  async activate(diagramId: string): Promise<void> {
    if (!(await this.repo.get(diagramId))) throw notFound(diagramId);
    await this.repo.setActiveId(diagramId);
    this.events.emit({ name: 'active.changed', payload: { diagramId } });
  }
}
