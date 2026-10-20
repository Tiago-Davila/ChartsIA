import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { layoutDiagram } from '@chartsia/core/layout';
import { type Diagram } from '@chartsia/core/model';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHub, type TestHub } from '../support/hub.js';

function classes(n: number) {
  const elements = Array.from({ length: n }, (_, i) => ({
    id: `C${i}`, kind: 'class', name: `Clase${i}`,
    attributes: [{ name: 'id', type: 'UUID', visibility: '-' }, { name: 'nombre', type: 'String', visibility: '-' }],
    operations: [{ name: 'guardar', parameters: [], visibility: '+' }],
  }));
  const relations = Array.from({ length: n - 1 }, (_, i) => ({ id: `r${i}`, kind: 'association', source: `C${i + 1}`, target: `C${Math.floor(i / 2)}` }));
  return { type: 'class', title: `Rendimiento ${n}`, elements, relations };
}

describe('rendimiento del hub (presupuesto interno para SC-001)', () => {
  let hub: TestHub;
  let client: Client;
  beforeAll(async () => {
    hub = await startHub();
    client = new Client({ name: 'perf', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${hub.url}/mcp`)));
    await client.callTool({ name: 'create_diagram', arguments: classes(5) }); // calentamiento de ELK
  });
  afterAll(async () => {
    await client.close();
    await hub.close();
  });

  it('create_diagram de 30 elementos responde en < 500 ms', async () => {
    const start = performance.now();
    const res = await client.callTool({ name: 'create_diagram', arguments: classes(30) });
    const elapsed = performance.now() - start;
    expect(res.isError).toBeFalsy();
    expect(elapsed).toBeLessThan(500);
  });

  it('layout de 200 elementos en < 1 s', async () => {
    const d = { ...classes(200), id: 'dg_aaaaaaaaaaaa', style: 'clean', revision: 0, createdAt: '', updatedAt: '' } as unknown as Diagram;
    const start = performance.now();
    await layoutDiagram(d);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
