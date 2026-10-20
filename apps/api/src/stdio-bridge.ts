#!/usr/bin/env node
/**
 * `chartsia-mcp`: puente stdio ↔ Streamable HTTP para clientes MCP que solo lanzan procesos
 * (p. ej. Claude Desktop). Reenvía cada mensaje JSON-RPC al hub, que conserva el estado.
 *   CHARTSIA_URL   URL del endpoint MCP (defecto http://127.0.0.1:3333/mcp)
 *   CHARTSIA_TOKEN token del hub si escucha fuera de loopback
 */
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isJSONRPCRequest, type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

const url = new URL(process.env.CHARTSIA_URL || 'http://127.0.0.1:3333/mcp');
const token = process.env.CHARTSIA_TOKEN;
const log = (text: string) => process.stderr.write(`[chartsia-mcp] ${text}\n`);
const hubDown = () =>
  `No se puede conectar con el hub de ChartsIA en ${url.origin}. Arráncalo con "pnpm dev" (o "pnpm --filter @chartsia/api start") y vuelve a intentarlo.`;

async function checkHub(): Promise<void> {
  try {
    const res = await fetch(new URL('/api/health', url), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) log(`El hub respondió ${res.status} en /api/health.`);
  } catch {
    log(hubDown());
  }
}

const stdio = new StdioServerTransport();
const http = new StreamableHTTPClientTransport(url, {
  requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
});

stdio.onmessage = (message: JSONRPCMessage) => {
  http.send(message).catch((error: Error) => {
    log(`${hubDown()} (${error.message})`);
    if (isJSONRPCRequest(message)) {
      void stdio.send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: hubDown() } });
    }
  });
};
http.onmessage = (message) => void stdio.send(message);
http.onerror = (error) => log(`Error del transporte HTTP: ${error.message}`);
stdio.onclose = () => void http.close().finally(() => process.exit(0));

await checkHub();
await http.start();
await stdio.start();
