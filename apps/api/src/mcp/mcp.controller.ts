import { All, Controller, HttpCode, Logger, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type Request, type Response } from 'express';
import { McpServerFactory } from './mcp-server.factory.js';

/**
 * Streamable HTTP sin estado en `/mcp`: un servidor y un transporte por petición. El estado
 * vive en el hub (repositorio), así cualquier agente ve los mismos diagramas.
 */
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger('McpController');

  constructor(private readonly factory: McpServerFactory) {}

  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
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

  /** En modo sin estado no hay stream de servidor (GET) ni sesiones que cerrar (DELETE). */
  @All()
  methodNotAllowed(@Res() res: Response): void {
    res.status(405).setHeader('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Método no permitido.' }, id: null });
  }
}
