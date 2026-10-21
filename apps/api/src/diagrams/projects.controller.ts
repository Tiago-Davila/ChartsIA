import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { type Project } from '@chartsia/core/model';
import { DomainValidationError, fromZodError } from '@chartsia/core/validation';
import { DiagramCommandService } from './diagram-command.service.js';
import { DiagramQueryService } from './diagram-query.service.js';

const NameBodySchema = z.strictObject({ name: z.unknown() });
const MoveBodySchema = z.strictObject({ projectId: z.string().max(64).nullable() });

/** Valida el cuerpo REST contra un esquema; el nombre lo valida después el servicio. */
function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new DomainValidationError(fromZodError(parsed.error));
  return parsed.data;
}

/** API de proyectos de la app: misma ruta de escritura que las herramientas MCP. */
@Controller('api')
export class ProjectsController {
  constructor(
    private readonly commands: DiagramCommandService,
    private readonly query: DiagramQueryService,
  ) {}

  @Get('projects')
  async list(): Promise<{ projects: Project[] }> {
    return { projects: (await this.query.list()).projects };
  }

  @Post('projects')
  create(@Body() body: unknown): Promise<Project> {
    return this.commands.createProject(parseBody(NameBodySchema, body).name);
  }

  @Patch('projects/:id')
  rename(@Param('id') id: string, @Body() body: unknown): Promise<Project> {
    return this.commands.renameProject(id, parseBody(NameBodySchema, body).name);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.commands.deleteProject(id);
  }

  @Put('diagrams/:id/project')
  @HttpCode(204)
  async move(@Param('id') id: string, @Body() body: unknown): Promise<void> {
    await this.commands.moveDiagram(id, parseBody(MoveBodySchema, body).projectId);
  }
}
