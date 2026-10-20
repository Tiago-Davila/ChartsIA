import { request } from 'node:http';
import { io } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { body, startHub, type TestHub } from '../support/hub.js';

const TOKEN = 'token-de-prueba-suficientemente-largo-123456';

const mcpInit = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
};
const mcpHeaders = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

function handshake(url: string, token?: string): Promise<'ok' | string> {
  return new Promise((resolve) => {
    const socket = io(`${url}/live`, { path: '/socket.io', transports: ['websocket'], auth: token ? { token } : {}, reconnection: false });
    socket.on('connect', () => {
      socket.close();
      resolve('ok');
    });
    socket.on('connect_error', (err) => {
      socket.close();
      resolve(err.message);
    });
  });
}

describe('auth fuera de loopback (CHARTSIA_HOST=0.0.0.0)', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_TOKEN: TOKEN });
  });
  afterAll(() => hub.close());

  it('sin token ⇒ 401 en /mcp y /api', async () => {
    expect((await fetch(`${hub.url}/mcp`, { method: 'POST', headers: mcpHeaders, body: JSON.stringify(mcpInit) })).status).toBe(401);
    const api = await fetch(`${hub.url}/api/diagrams`);
    expect(api.status).toBe(401);
    expect((await body(api)).errors[0].code).toBe('UNAUTHORIZED');
  });

  it('token incorrecto ⇒ 401', async () => {
    expect((await fetch(`${hub.url}/api/diagrams`, { headers: { authorization: 'Bearer otro' } })).status).toBe(401);
  });

  it('sin token ⇒ handshake de /live rechazado', async () => {
    expect(await handshake(hub.url)).toBe('unauthorized');
    expect(await handshake(hub.url, 'otro')).toBe('unauthorized');
  });

  it('con token ⇒ OK (header en REST/MCP, auth.token en el handshake)', async () => {
    const auth = { authorization: `Bearer ${TOKEN}` };
    expect((await fetch(`${hub.url}/api/diagrams`, { headers: auth })).status).toBe(200);
    expect((await fetch(`${hub.url}/mcp`, { method: 'POST', headers: { ...mcpHeaders, ...auth }, body: JSON.stringify(mcpInit) })).status).toBe(200);
    expect(await handshake(hub.url, TOKEN)).toBe('ok');
  });

  it('/api/health no exige token', async () => {
    expect((await fetch(`${hub.url}/api/health`)).status).toBe(200);
  });

  it('el token no aparece en los logs, aunque se registren cabeceras', async () => {
    await fetch(`${hub.url}/api/diagrams`, { headers: { authorization: `Bearer ${TOKEN}` } });
    await fetch(`${hub.url}/api/diagrams`, { headers: { authorization: `Bearer ${TOKEN}x` } });
    expect(hub.logs.length).toBeGreaterThan(0);
    expect(hub.logs.join('\n')).not.toContain(TOKEN);
  });

  it('anuncia la URL de la app con el token en el fragmento', () => {
    expect(hub.announced.join('')).toContain(`/#token=${TOKEN}`);
  });
});

describe('token generado', () => {
  it('sin CHARTSIA_TOKEN fuera de loopback se genera, se guarda y se reutiliza', async () => {
    const hub = await startHub({ CHARTSIA_HOST: '0.0.0.0' });
    const token = /#token=(\S+)/.exec(hub.announced.join(''))?.[1];
    expect(token).toBeDefined();
    expect((await fetch(`${hub.url}/api/diagrams`, { headers: { authorization: `Bearer ${token}` } })).status).toBe(200);
    const { resolveToken } = await import('../../src/auth/token.js');
    const again = await resolveToken({ dataDir: hub.dataDir, authRequired: true, token: undefined });
    expect(again).toEqual({ token, generated: false });
    await hub.close();
  });
});

describe('loopback sin token', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub();
  });
  afterAll(() => hub.close());

  it('acepta peticiones sin token en /api, /mcp y /live', async () => {
    expect((await fetch(`${hub.url}/api/diagrams`)).status).toBe(200);
    expect((await fetch(`${hub.url}/mcp`, { method: 'POST', headers: mcpHeaders, body: JSON.stringify(mcpInit) })).status).toBe(200);
    expect(await handshake(hub.url)).toBe('ok');
    expect(hub.announced).toEqual([]);
  });

  it('rechaza un Host ajeno (protección contra DNS rebinding)', async () => {
    // fetch no permite fijar Host: se usa node:http.
    const status = await new Promise<number>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port: hub.port, path: '/api/diagrams', headers: { host: 'evil.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(421);
  });
});
