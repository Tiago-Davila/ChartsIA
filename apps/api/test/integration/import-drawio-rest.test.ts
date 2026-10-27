import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, startHub, type TestHub } from '../support/hub.js';

const SOURCE =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="A" value="Servidor" style="rounded=0;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="B" value="Cliente" style="ellipse;html=1;" vertex="1" parent="1"><mxGeometry x="300" y="60" width="120" height="60" as="geometry"/></mxCell>' +
  '<mxCell id="C" value="HTTPS" style="endArrow=classic;" edge="1" parent="1" source="B" target="A"><mxGeometry relative="1" as="geometry"/></mxCell>' +
  '</root></mxGraphModel>';

describe('API REST: POST /api/diagrams/import-drawio', () => {
  let hub: TestHub;
  const post = (payload: unknown) =>
    fetch(`${hub.url}/api/diagrams/import-drawio`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

  beforeAll(async () => { hub = await startHub(); });
  afterAll(() => hub.close());

  it('crea el diagrama canónico con las posiciones del archivo, lo activa y devuelve warnings', async () => {
    const response = await post({ source: SOURCE, title: 'Desde draw.io' });
    expect(response.status).toBe(201);
    const created = await body(response);
    expect(created).toMatchObject({ revision: 1, counts: { elements: 2, relations: 1 }, warnings: [] });
    const diagram = await body(await fetch(`${hub.url}/api/diagrams/${created.diagramId}`));
    expect(diagram).toMatchObject({
      title: 'Desde draw.io',
      elements: [
        { id: 'A', kind: 'figure', shape: 'rectangle', name: 'Servidor', layout: { x: 40, y: 60 } },
        { id: 'B', kind: 'figure', shape: 'oval', name: 'Cliente', layout: { x: 300, y: 60 } },
      ],
      relations: [{ kind: 'connector', label: 'HTTPS', source: 'B', target: 'A' }],
    });
    expect((await body(await fetch(`${hub.url}/api/diagrams`))).activeDiagramId).toBe(created.diagramId);
  });

  it('rechaza XML inválido, DOCTYPE y texto sobre el límite con ruta y ayuda, sin persistir', async () => {
    const before = (await body(await fetch(`${hub.url}/api/diagrams`))).diagrams.length;
    const evil = await post({ source: '<!DOCTYPE x [<!ENTITY e "boom">]><mxGraphModel><root/></mxGraphModel>' });
    expect(evil.status).toBe(422);
    expect((await body(evil)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/source', message: expect.stringContaining('DOCTYPE'), hint: expect.stringMatching(/\S/) });
    const broken = await post({ source: 'hola' });
    expect(broken.status).toBe(422);
    expect((await body(broken)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/source' });
    const oversized = await post({ source: 'x'.repeat(4 * 1024 * 1024 + 1) });
    expect(oversized.status).toBe(422);
    expect((await body(oversized)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/source' });
    expect((await body(await fetch(`${hub.url}/api/diagrams`))).diagrams).toHaveLength(before);
  });
});
