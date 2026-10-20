import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sampleDiagram, startHub, type TestHub } from '../support/hub.js';

describe('contract sobre HTTP real (Streamable HTTP)', () => {
  let hub: TestHub;
  let client: Client;
  beforeAll(async () => {
    hub = await startHub();
    client = new Client({ name: 'http-contract', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${hub.url}/mcp`)));
  });
  afterAll(async () => {
    await client.close();
    await hub.close();
  });

  it('crear → aplicar → exportar', async () => {
    expect((await client.listTools()).tools).toHaveLength(7);
    const created = await client.callTool({ name: 'create_diagram', arguments: sampleDiagram });
    const diagramId = (created.structuredContent as { diagramId: string }).diagramId;
    expect(created.isError).toBeFalsy();

    const applied = await client.callTool({
      name: 'apply_changes',
      arguments: { diagramId, operations: [{ op: 'add_element', element: { id: 'Editorial', kind: 'class', name: 'Editorial', attributes: [], operations: [] } }] },
    });
    expect(applied.structuredContent).toMatchObject({ diagramId, revision: 2, applied: 1 });

    const exported = await client.callTool({ name: 'export_diagram', arguments: { format: 'drawio' } });
    expect((exported.structuredContent as { content: string }).content).toContain('Editorial');

    const invalid = await client.callTool({ name: 'apply_changes', arguments: { operations: [{ op: 'remove_element', id: 'Nadie' }] } });
    expect(invalid.isError).toBe(true);
    expect((invalid.structuredContent as { errors: { code: string }[] }).errors[0]!.code).toBe('UNKNOWN_REFERENCE');
  });

  it('los recursos funcionan sobre HTTP', async () => {
    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates.map((t) => t.uriTemplate)).toContain('chartsia://schema/{type}');
    const guide = await client.readResource({ uri: 'chartsia://schema/class' });
    expect((guide.contents[0] as { text: string }).text).toContain('inheritance');
  });

  it('GET y DELETE /mcp ⇒ 405 en modo sin estado', async () => {
    expect((await fetch(`${hub.url}/mcp`)).status).toBe(405);
    expect((await fetch(`${hub.url}/mcp`, { method: 'DELETE' })).status).toBe(405);
  });
});
