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

/** Devuelve el tiempo en ms que tarda fn en completarse. */
async function cronometrar(fn: () => unknown): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

/** Devuelve el menor tiempo en ms de n ejecuciones de fn, para no depender de un pico de carga. */
async function mejorDe(n: number, fn: () => Promise<unknown>): Promise<number> {
  let mejor = Infinity;
  for (let i = 0; i < n; i++) mejor = Math.min(mejor, await cronometrar(fn));
  return mejor;
}

/** Carga de CPU sobre el diagrama que dura lo mismo que el layout y mide la velocidad relativa de la máquina. */
function cargaDeReferencia(d: Diagram): number {
  let total = 0;
  for (let i = 0; i < 400; i++) total += JSON.parse(JSON.stringify(d)).elements.length;
  return total;
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
    const mejor = await mejorDe(5, async () => {
      const res = await client.callTool({ name: 'create_diagram', arguments: classes(30) });
      expect(res.isError).toBeFalsy();
    });
    expect(mejor).toBeLessThan(500);
  });

  it('layout de 200 elementos sin regresión frente a una referencia de CPU', async () => {
    const d = { ...classes(200), id: 'dg_aaaaaaaaaaaa', style: 'clean', revision: 0, createdAt: '', updatedAt: '' } as unknown as Diagram;
    let layout = Infinity;
    let referencia = Infinity;
    for (let i = 0; i < 7; i++) {
      referencia = Math.min(referencia, await cronometrar(() => cargaDeReferencia(d)));
      layout = Math.min(layout, await cronometrar(() => layoutDiagram(d)));
    }
    // La razón ronda 1 sin carga y no pasa de 1,5 con la CPU saturada; un layout 2× más lento da ≈ 2.
    expect(layout / referencia).toBeLessThan(1.7);
    expect(layout).toBeLessThan(5000);
  }, 60_000);
});
