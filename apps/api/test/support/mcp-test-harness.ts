import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ExportService } from '../../src/diagrams/export.service.js';
import { McpServerFactory } from '../../src/mcp/mcp-server.factory.js';
import { ToolResultFormatter } from '../../src/mcp/tool-result.js';
import { createServices } from './services.js';

export type ToolResult = CallToolResult & {
  structuredContent?: Record<string, unknown> & { errors?: { code: string; path: string; message: string; hint: string }[] };
};

/**
 * Cliente MCP del SDK conectado por `InMemoryTransport` al servidor real de ChartsIA, con
 * repositorio en memoria y reloj fijo (contract tests, principio V).
 */
export async function createMcpHarness(overrides: { maxElements?: number } = {}) {
  const services = createServices(overrides);
  const exports = new ExportService(services.query);
  const formatter = new ToolResultFormatter(services.config);
  const factory = new McpServerFactory(services.commands, services.query, exports, formatter);
  const server = factory.create();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'contract-test', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const call = async (name: string, args: Record<string, unknown> = {}) =>
    (await client.callTool({ name, arguments: args })) as ToolResult;

  return {
    ...services,
    client,
    call,
    /** Códigos de error de un resultado `isError`. */
    errorCodes: (result: ToolResult) => (result.structuredContent?.errors ?? []).map((e) => e.code),
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export type McpHarness = Awaited<ReturnType<typeof createMcpHarness>>;

export const minimalClass = {
  type: 'class',
  title: 'Pedidos',
  elements: [{ id: 'Pedido', kind: 'class', name: 'Pedido', attributes: [], operations: [] }],
  relations: [],
};

export const fullClass = {
  type: 'class',
  title: 'Pedidos',
  style: 'sketch',
  elements: [
    { id: 'Pedido', kind: 'class', name: 'Pedido', stereotype: 'entity', description: 'Pedido de compra',
      attributes: [{ name: 'total', type: 'Decimal', visibility: '-', defaultValue: '0' }],
      operations: [{ name: 'confirmar', parameters: [{ name: 'fecha', type: 'Date' }], returnType: 'void', visibility: '+' }] },
    { id: 'Linea', kind: 'class', name: 'LineaPedido', attributes: [], operations: [], parentId: 'ventas' },
    { id: 'Pagable', kind: 'interface', name: 'Pagable', operations: [{ name: 'pagar', parameters: [], visibility: '+', abstract: true }] },
    { id: 'Estado', kind: 'enum', name: 'Estado', literals: ['NUEVO', 'PAGADO'] },
    { id: 'ventas', kind: 'package', name: 'ventas' },
    { id: 'Base', kind: 'class', name: 'Entidad', abstract: true, attributes: [], operations: [], layout: { x: 600, y: 0 } },
  ],
  relations: [
    { id: 'r1', kind: 'composition', source: 'Pedido', target: 'Linea', sourceMultiplicity: '1', targetMultiplicity: '1..*' },
    { id: 'r2', kind: 'realization', source: 'Pedido', target: 'Pagable' },
    { id: 'r3', kind: 'dependency', source: 'Pedido', target: 'Estado', label: 'usa' },
    { id: 'r4', kind: 'inheritance', source: 'Pedido', target: 'Base' },
    { id: 'r5', kind: 'association', source: 'Linea', target: 'Estado', navigable: 'source-to-target' },
  ],
};
