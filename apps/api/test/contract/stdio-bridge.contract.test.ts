import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, sampleDiagram, startHub, type TestHub } from '../support/hub.js';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const bridge = join(apiRoot, 'dist/stdio-bridge.js');

describe('smoke del puente stdio chartsia-mcp', () => {
  let hub: TestHub;
  beforeAll(async () => {
    // El puente se ejecuta compilado, como lo lanzaría Claude Desktop.
    execFileSync('pnpm', ['--filter', '@chartsia/core', '--filter', '@chartsia/api', 'build'], { cwd: apiRoot, stdio: 'ignore' });
    hub = await startHub();
  }, 120_000);
  afterAll(() => hub.close());

  it('lista herramientas y crea un diagrama a través del hub', async () => {
    const client = new Client({ name: 'stdio-smoke', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [bridge], env: { ...process.env, CHARTSIA_URL: `${hub.url}/mcp` } as Record<string, string> }));
    expect((await client.listTools()).tools.map((t) => t.name)).toContain('create_diagram');
    const res = await client.callTool({ name: 'create_diagram', arguments: sampleDiagram });
    const id = (res.structuredContent as { diagramId: string }).diagramId;
    const list = await body(await fetch(`${hub.url}/api/diagrams`));
    expect(list.activeDiagramId).toBe(id);
    await client.close();
  });

  it('con el hub caído responde un error claro', async () => {
    const client = new Client({ name: 'stdio-smoke', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bridge],
      env: { ...process.env, CHARTSIA_URL: 'http://127.0.0.1:9/mcp' } as Record<string, string>,
      stderr: 'pipe',
    });
    await expect(client.connect(transport)).rejects.toThrow(/No se puede conectar con el hub/);
    await client.close();
  });
});
