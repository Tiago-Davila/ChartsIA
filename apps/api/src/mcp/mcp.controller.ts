import { All, Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type Request, type Response } from 'express';
import { AgentRegistry } from '../agents/agent-registry.js';
import { McpServerFactory } from './mcp-server.factory.js';

/**
 * Streamable HTTP sin estado en `/mcp`: un servidor y un transporte por petición. El estado
 * vive en el hub (repositorio), así cualquier agente ve los mismos diagramas.
 */
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger('McpController');

  constructor(
    private readonly factory: McpServerFactory,
    private readonly agents: AgentRegistry,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.trackAgent(req, res);
    const server = this.factory.create();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error(`Error en /mcp: ${(error as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Error interno del servidor' }, id: null });
      }
    }
  }

  /**
   * El transporte es sin estado: en `initialize` se da al cliente un `Mcp-Session-Id` propio
   * (el SDK cliente y el puente stdio lo reenvían) para atribuirle después sus llamadas.
   */
  private trackAgent(req: Request, res: Response): void {
    const body = req.body as { method?: unknown; params?: { clientInfo?: unknown } } | undefined;
    if (body?.method === 'initialize') {
      const sessionId = this.agents.register(body.params?.clientInfo);
      if (sessionId) res.setHeader('Mcp-Session-Id', sessionId);
    } else {
      const sessionId = req.headers['mcp-session-id'];
      if (typeof sessionId === 'string') this.agents.touch(sessionId);
    }
  }

  /** En modo sin estado no hay stream de servidor (GET) ni sesiones que cerrar (DELETE). */
  @All()
  methodNotAllowed(@Res() res: Response): void {
    res.status(405).setHeader('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Método no permitido.' }, id: null });
  }
}
