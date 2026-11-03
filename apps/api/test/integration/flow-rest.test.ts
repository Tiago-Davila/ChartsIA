import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, startHub, type TestHub } from '../support/hub.js';

describe('flujos de sistema por REST', () => {
  let hub: TestHub;
  const json = (path: string, init: RequestInit = {}) =>
    fetch(`${hub.url}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });

  beforeAll(async () => {
    hub = await startHub();
  });
  afterAll(() => hub.close());

  it('crea un flujo vacío y le agrega nodos y conexiones como operaciones', async () => {
    const created = await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'flow', title: 'Pedido' }) });
    expect(created.status).toBe(201);
    const { diagramId } = await body(created);
    const res = await json(`/api/diagrams/${diagramId}/operations`, {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          { op: 'add_element', element: { id: 'a', kind: 'flow-node', variant: 'trigger', name: 'POST /orders' } },
          { op: 'add_element', element: { id: 'b', kind: 'flow-node', variant: 'database', name: 'orders', subtitle: 'PostgreSQL' } },
          { op: 'add_relation', relation: { id: 'r1', kind: 'flow-edge', source: 'a', target: 'b', flowType: 'write' } },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const diagram = await body(await json(`/api/diagrams/${diagramId}`));
    expect(diagram.type).toBe('flow');
    const [a, b] = diagram.elements;
    expect(a.layout.x).toBeLessThan(b.layout.x);
    expect(diagram.relations[0].route.length).toBeGreaterThanOrEqual(2);
  });

  it('rechaza con 422 una salida de decisión sin etiqueta', async () => {
    const created = await body(await json('/api/diagrams', { method: 'POST', body: JSON.stringify({ type: 'flow', title: 'Decisión' }) }));
    const res = await json(`/api/diagrams/${created.diagramId}/operations`, {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          { op: 'add_element', element: { id: 'd', kind: 'flow-node', variant: 'decision', name: '¿Hay stock?' } },
          { op: 'add_element', element: { id: 'm', kind: 'flow-node', variant: 'method', name: 'reject' } },
          { op: 'add_relation', relation: { id: 'r1', kind: 'flow-edge', source: 'd', target: 'm' } },
        ],
      }),
    });
    expect(res.status).toBe(422);
    expect((await body(res)).errors[0]).toMatchObject({ code: 'FIELD_REQUIRED' });
  });
});
