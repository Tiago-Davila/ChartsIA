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

  @Post(':id/activate')
  @HttpCode(204)
  async activate(@Param('id') id: string): Promise<void> {
    await this.commands.activate(id);
  }
}
