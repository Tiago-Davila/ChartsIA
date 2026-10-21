import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { toToolJsonSchema } from '@chartsia/core/model';
import { fromZodError, isDomainValidationError, validationError } from '@chartsia/core/validation';
import { DiagramCommandService } from '../diagrams/diagram-command.service.js';
import { DiagramQueryService } from '../diagrams/diagram-query.service.js';
import { ExportService } from '../diagrams/export.service.js';
import { listResources, readResource, RESOURCE_TEMPLATES } from './resources.js';
import { ToolResultFormatter } from './tool-result.js';
import { applyChangesTool } from './tools/apply-changes.tool.js';
import { createDiagramTool } from './tools/create-diagram.tool.js';
import { exportDiagramTool } from './tools/export-diagram.tool.js';
import { getDiagramTool } from './tools/get-diagram.tool.js';
import { createProjectTool } from './tools/create-project.tool.js';
import { moveDiagramTool } from './tools/move-diagram.tool.js';
import { listDiagramsTool } from './tools/list-diagrams.tool.js';
import { openDiagramTool } from './tools/open-diagram.tool.js';
import { undoChangesTool } from './tools/undo-changes.tool.js';
import { FailureSchema } from './tools/schemas.js';
import { type ToolDefinition } from './tools/tool-definition.js';

/** Versión semántica del contrato de herramientas (principio VI). */
export const SCHEMA_VERSION = '1.0.0';

const INSTRUCTIONS = [
  'ChartsIA dibuja diagramas de clases UML y C4 en una app que la persona tiene abierta.',
  'Flujo habitual: create_diagram con la estructura (sin coordenadas) → apply_changes para cada refinamiento → export_diagram si piden un archivo. undo_changes deshace o rehace el último cambio.',
  'Cada pedido de un diagrama nuevo o distinto (otro tema, sistema o tipo) va con create_diagram, que no toca los diagramas anteriores; apply_changes solo refina el diagrama existente del que se habla (por defecto el activo).',
  'Usa get_diagram para conocer los ids actuales antes de editar y list_diagrams / open_diagram para cambiar de diagrama.',
  'No agrupes diagramas en proyectos (create_project, move_diagram, projectId de create_diagram) salvo que la persona lo pida.',
  'No agrupes elementos en package o boundary salvo que la persona lo pida (o que un component lo exija).',
  'Si una herramienta devuelve isError, lee code, path y hint de cada error, corrige la entrada y vuelve a llamarla.',
].join(' ');

/**
 * Crea instancias del servidor MCP de ChartsIA. Usa el `Server` de bajo nivel del SDK para
 * publicar exactamente el subconjunto de JSON Schema común a Claude y OpenAI (research R3)
 * y devolver los errores de validación como resultados `isError` corregibles.
 */
@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger('McpServer');
  private readonly tools: ToolDefinition[];
  private readonly listing: Tool[];

  constructor(
    commands: DiagramCommandService,
    query: DiagramQueryService,
    private readonly exports: ExportService,
    private readonly results: ToolResultFormatter,
  ) {
    this.query = query;
    this.tools = [
      createDiagramTool(commands, results),
      applyChangesTool(commands, results),
      getDiagramTool(query),
      listDiagramsTool(query),
      openDiagramTool(commands, results),
      exportDiagramTool(exports, results),
      undoChangesTool(commands, results),
      createProjectTool(commands),
      moveDiagramTool(commands),
    ];
    const failure = toToolJsonSchema(FailureSchema);
    this.listing = this.tools.map((tool) => ({
      name: tool.name,
      title: tool.annotations.title,
      description: tool.description,
      inputSchema: toToolJsonSchema(tool.input) as Tool['inputSchema'],
      outputSchema: { type: 'object', anyOf: [toToolJsonSchema(tool.output), failure] } as Tool['outputSchema'],
      annotations: tool.annotations,
    }));
  }

  private readonly query: DiagramQueryService;

  create(): Server {
    const server = new Server(
      { name: 'chartsia', title: 'ChartsIA', version: SCHEMA_VERSION },
      { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.listing }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => this.callTool(request.params.name, request.params.arguments));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: RESOURCE_TEMPLATES }));
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: await listResources(this.query) }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => readResource(request.params.uri, this.query, this.exports));
    return server;
  }

  private async callTool(name: string, args: unknown): Promise<CallToolResult> {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, `Herramienta desconocida: ${name}`);
    const parsed = tool.input.safeParse(args ?? {});
    if (!parsed.success) return this.results.failure(fromZodError(parsed.error));
    try {
      return this.results.success(await tool.run(parsed.data));
    } catch (error) {
      if (isDomainValidationError(error)) return this.results.failure(error.errors);
      this.logger.error(`Fallo interno en ${name}: ${(error as Error).message}`, (error as Error).stack);
      return this.results.failure([
        validationError('SCHEMA_VIOLATION', '', 'Error interno del servidor al ejecutar la herramienta.', 'Reintenta; si persiste, revisa los logs del hub.'),
      ]);
    }
  }
}
