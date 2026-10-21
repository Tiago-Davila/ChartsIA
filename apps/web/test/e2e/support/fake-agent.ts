import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type AgentResult = CallToolResult & {
  structuredContent?: Record<string, unknown> & { errors?: { code: string; path: string; message: string; hint: string }[] };
};

/**
 * Agente simulado: usa el `Client` del SDK MCP sobre Streamable HTTP, igual que Claude Code
 * o la Responses API, para ejecutar los escenarios guionados del quickstart.
 */
export class FakeAgent {
  private client?: Client;
  constructor(
    private readonly baseUrl: string,
    private readonly name = 'chartsia-e2e-agent',
  ) {}

  async connect(): Promise<this> {
    this.client = new Client({ name: this.name, version: '1.0.0' });
    await this.client.connect(new StreamableHTTPClientTransport(new URL(`${this.baseUrl}/mcp`)));
    return this;
  }

  async call(name: string, args: Record<string, unknown> = {}): Promise<AgentResult> {
    if (!this.client) throw new Error('FakeAgent no conectado');
    return (await this.client.callTool({ name, arguments: args })) as AgentResult;
  }

  async create(input: Record<string, unknown>): Promise<string> {
    const res = await this.call('create_diagram', input);
    if (res.isError) throw new Error(JSON.stringify(res.structuredContent));
    return res.structuredContent!.diagramId as string;
  }

  async apply(operations: unknown[], diagramId?: string): Promise<AgentResult> {
    return this.call('apply_changes', { ...(diagramId ? { diagramId } : {}), operations });
  }

  async layout(diagramId?: string): Promise<{ elements: { id: string; kind: string; parentId?: string; name: string; layout: { x: number; y: number; width: number; height: number; pinned: boolean; resized?: boolean } }[]; relations: { id: string; kind: string; source: string; target: string; label?: string; sourceSide?: string; route: { x: number; y: number }[]; waypoints?: { x: number; y: number }[] }[]; title: string }> {
    const res = await this.call('get_diagram', { ...(diagramId ? { diagramId } : {}), includeLayout: true });
    return res.structuredContent as never;
  }

  async close(): Promise<void> {
    await this.client?.close();
  }
}

export const library = {
  type: 'class',
  title: 'Biblioteca',
  elements: [
    { id: 'Libro', kind: 'class', name: 'Libro', attributes: [{ name: 'isbn', type: 'String', visibility: '-' }, { name: 'titulo', type: 'String', visibility: '-' }], operations: [] },
    { id: 'Autor', kind: 'class', name: 'Autor', attributes: [{ name: 'nombre', type: 'String', visibility: '-' }], operations: [] },
    { id: 'Socio', kind: 'class', name: 'Socio', attributes: [{ name: 'numero', type: 'int', visibility: '-' }], operations: [{ name: 'prestar', parameters: [{ name: 'libro', type: 'Libro' }], returnType: 'Prestamo', visibility: '+' }] },
    { id: 'Prestamo', kind: 'class', name: 'Préstamo', attributes: [{ name: 'desde', type: 'Date', visibility: '-' }], operations: [{ name: 'devolver', parameters: [], visibility: '+' }] },
  ],
  relations: [
    { id: 'r1', kind: 'association', source: 'Libro', target: 'Autor', targetMultiplicity: '1..*' },
    { id: 'r2', kind: 'composition', source: 'Socio', target: 'Prestamo', targetMultiplicity: '0..*' },
    { id: 'r3', kind: 'association', source: 'Prestamo', target: 'Libro', navigable: 'source-to-target' },
  ],
};

export const shop = {
  type: 'c4-container',
  title: 'Tienda online',
  elements: [
    { id: 'cliente', kind: 'person', name: 'Cliente', description: 'Compra productos' },
    { id: 'tienda', kind: 'boundary', name: 'Tienda online', boundaryType: 'system' },
    { id: 'web', kind: 'container', name: 'Aplicación web', technology: 'React', variant: 'web', parentId: 'tienda' },
    { id: 'api', kind: 'container', name: 'API', technology: 'Nest.js', parentId: 'tienda' },
    { id: 'db', kind: 'container', name: 'Base de datos', technology: 'PostgreSQL', variant: 'database', parentId: 'tienda' },
    { id: 'pagos', kind: 'software-system', name: 'Pasarela de pagos', external: true },
  ],
  relations: [
    { id: 'u1', kind: 'c4-rel', source: 'cliente', target: 'web', label: 'Compra', technology: 'HTTPS' },
    { id: 'u2', kind: 'c4-rel', source: 'web', target: 'api', label: 'Llama a', technology: 'JSON/HTTPS' },
    { id: 'u3', kind: 'c4-rel', source: 'api', target: 'db', label: 'Lee y escribe', technology: 'SQL' },
    { id: 'u4', kind: 'c4-rel', source: 'api', target: 'pagos', label: 'Cobra', technology: 'HTTPS' },
  ],
};

type Box = { x: number; y: number; width: number; height: number };

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
