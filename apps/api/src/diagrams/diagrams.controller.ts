import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { type Diagram } from '@chartsia/core/model';
import { DomainValidationError, fromZodError } from '@chartsia/core/validation';
import { PublicUrls } from '../common/public-urls.js';
import { APP_CONFIG, type AppConfig } from '../config/config.js';
import { DiagramCommandService } from './diagram-command.service.js';
import { type DiagramList, DiagramQueryService } from './diagram-query.service.js';

const OperationsBodySchema = z.strictObject({
  baseRevision: z.number().int().nonnegative().optional(),
  operations: z.unknown(),
});

const CreateBodySchema = z.strictObject({
  type: z.unknown(),
  title: z.unknown(),
  projectId: z.string().max(64).optional(),
});

/** API interna de la app ([app-api.md]): misma ruta de escritura que las herramientas MCP. */
@Controller('api/diagrams')
export class DiagramsController {
  private readonly urls: PublicUrls;

  constructor(
    private readonly commands: DiagramCommandService,
    private readonly query: DiagramQueryService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.urls = new PublicUrls(config);
  }

  @Get()
  list(): Promise<DiagramList> {
    return this.query.list();
  }

  /** Crea un diagrama vacío por la misma ruta que `create_diagram`; el tipo y el título los valida el servicio. */
  @Post()
  async create(@Body() body: unknown) {
    const parsed = CreateBodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
    const { type, title, projectId } = parsed.data;
    const { diagram } = await this.commands.create({ type, title, elements: [], relations: [] }, projectId);
    return { diagramId: diagram.id, revision: diagram.revision, viewUrl: this.urls.view(diagram.id) };
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<Diagram> {
    return this.query.get(id, true);
  }

  @Post(':id/operations')
  @HttpCode(200)
  async operations(@Param('id') id: string, @Body() body: unknown) {
    const parsed = OperationsBodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
    const { diagram, applied, warnings } = await this.commands.apply({ diagramId: id, ...parsed.data, origin: 'app' });
    return { diagramId: diagram.id, revision: diagram.revision, viewUrl: this.urls.view(diagram.id), applied, warnings };
  }

  @Post(':id/undo')
  @HttpCode(200)
  async undo(@Param('id') id: string) {
    const diagram = await this.commands.undo({ diagramId: id, direction: 'undo', origin: 'app' });
    return { diagramId: diagram.id, revision: diagram.revision };
  }

  @Post(':id/redo')
  @HttpCode(200)
  async redo(@Param('id') id: string) {
    const diagram = await this.commands.undo({ diagramId: id, direction: 'redo', origin: 'app' });
    return { diagramId: diagram.id, revision: diagram.revision };
  }

  @Post(':id/activate')
  @HttpCode(204)
  async activate(@Param('id') id: string): Promise<void> {
    await this.commands.activate(id);
  }
}
