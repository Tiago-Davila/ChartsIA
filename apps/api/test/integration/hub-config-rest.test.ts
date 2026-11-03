import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { JsonLogger } from '../../src/common/logger.js';
import { loadConfig } from '../../src/config/config.js';
import { body, startHub, type TestHub } from '../support/hub.js';

const TOKEN = 'token-de-prueba-suficientemente-largo-123456';

/** Hub con la carpeta de datos tomada de `config.json` (sin CHARTSIA_DATA_DIR). */
async function startHubFromFile(hub: Record<string, unknown>, env: Record<string, string> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'chartsia-hub-config-'));
  const configFile = join(root, 'config.json');
  await writeFile(configFile, JSON.stringify({ otro: { valor: 1 }, hub: { dataDir: join(root, 'datos'), ...hub } }));
  const app = await createApp(loadConfig({ CHARTSIA_CONFIG_FILE: configFile, CHARTSIA_PORT: '1', ...env }), { logger: new JsonLogger({ level: 'error' }), announce: () => undefined });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as { port: number };
  return { root, configFile, url: `http://127.0.0.1:${port}`, close: async () => { await app.close(); await rm(root, { recursive: true, force: true }); } };
}

const put = (url: string, changes: unknown) => fetch(`${url}/api/hub/config`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changes) });

describe('API REST /api/hub/config', () => {
  let hub: Awaited<ReturnType<typeof startHubFromFile>>;
  beforeAll(async () => {
    hub = await startHubFromFile({});
  });
  afterAll(() => hub.close());

  it('GET devuelve los valores con su origen y sin reinicio pendiente', async () => {
    const res = await fetch(`${hub.url}/api/hub/config`);
    expect(res.status).toBe(200);
    const config = await body(res);
    expect(config).toMatchObject({
      dataDir: { value: join(hub.root, 'datos'), source: 'file', running: join(hub.root, 'datos') },
      maxElements: { value: 500, source: 'default' },
      network: { value: false, source: 'default', running: false },
      token: { value: null, source: 'default' },
      restartRequired: false,
    });
  });

  it('el límite de elementos se guarda, se aplica al instante y conserva el resto del archivo', async () => {
    const res = await put(hub.url, { maxElements: 3 });
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ maxElements: { value: 3, source: 'file' }, restartRequired: false });
    const file = JSON.parse(await readFile(hub.configFile, 'utf8'));
    expect(file.otro).toEqual({ valor: 1 });
    expect(file.hub).toMatchObject({ maxElements: 3, dataDir: join(hub.root, 'datos') });
    expect(((await stat(hub.configFile)).mode & 0o777).toString(8)).toBe('600');

    const elements = Array.from({ length: 4 }, (_, i) => ({ id: `E${i}`, kind: 'enum', name: `E${i}`, literals: ['A'] }));
    const created = await fetch(`${hub.url}/api/diagrams`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'class', title: 'Grande' }) });
    expect(created.status).toBe(201);
    const diagramId = (await body(created)).diagramId;
    const apply = await fetch(`${hub.url}/api/diagrams/${diagramId}/operations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: elements.map((element) => ({ op: 'add_element', element })) }),
    });
    expect(apply.status).toBe(422);
    expect((await body(apply)).errors[0]).toMatchObject({ code: 'LIMIT_EXCEEDED' });

    expect(await body(await put(hub.url, { maxElements: null }))).toMatchObject({ maxElements: { value: 500, source: 'default' } });
  });

  it('cambiar la carpeta de datos se guarda pero exige reiniciar', async () => {
    const nueva = join(hub.root, 'otra-carpeta');
    const res = await put(hub.url, { dataDir: nueva });
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ dataDir: { value: nueva, source: 'file', running: join(hub.root, 'datos') }, restartRequired: true });
    expect((await stat(nueva)).isDirectory()).toBe(true);
    // Volver a la carpeta en uso quita el aviso.
    expect(await body(await put(hub.url, { dataDir: join(hub.root, 'datos') }))).toMatchObject({ restartRequired: false });
  });

  it('habilitar la red guarda un token fuerte, exige reiniciar y no cambia lo que el hub hace ahora', async () => {
    const res = await put(hub.url, { network: true });
    const config = await body(res);
    expect(config).toMatchObject({ network: { value: true, source: 'file', running: false }, token: { source: 'file' }, restartRequired: true });
    expect(config.token.value).toHaveLength(43);
    // El hub sigue en loopback: sin token en la petición todavía responde.
    expect((await fetch(`${hub.url}/api/hub/config`)).status).toBe(200);
    expect(JSON.parse(await readFile(hub.configFile, 'utf8')).hub).toMatchObject({ network: true, token: config.token.value });
    expect(await body(await put(hub.url, { network: false }))).toMatchObject({ network: { value: false }, restartRequired: false });
  });

  it('regenerar el token crea uno nuevo distinto cada vez', async () => {
    const first = (await body(await fetch(`${hub.url}/api/hub/token`, { method: 'POST' }))).token.value;
    const second = (await body(await fetch(`${hub.url}/api/hub/token`, { method: 'POST' }))).token.value;
    expect(first).toHaveLength(43);
    expect(second).toHaveLength(43);
    expect(second).not.toBe(first);
  });

  it('rechaza valores inválidos con 422 y no cambia nada', async () => {
    for (const bad of [{ maxElements: 0 }, { maxElements: 1.5 }, { dataDir: 'relativa/carpeta' }, { dataDir: '' }, { network: 'si' }, { puerto: 1 }]) {
      const res = await put(hub.url, bad);
      expect(res.status, JSON.stringify(bad)).toBe(422);
      expect((await body(res)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION' });
    }
    expect(await body(await fetch(`${hub.url}/api/hub/config`))).toMatchObject({ maxElements: { value: 500 } });
  });
});

describe('prioridad de las variables de entorno en /api/hub/config', () => {
  it('muestra que el valor viene de la variable y no lo cambia el archivo', async () => {
    const hub = await startHub({ CHARTSIA_MAX_ELEMENTS: '7' });
    try {
      const inicial = await body(await fetch(`${hub.url}/api/hub/config`));
      expect(inicial).toMatchObject({ dataDir: { source: 'env', value: hub.dataDir }, maxElements: { value: 7, source: 'env' } });
      const guardado = await body(await put(hub.url, { maxElements: 20 }));
      expect(guardado).toMatchObject({ maxElements: { value: 7, source: 'env' }, restartRequired: false });
      expect(JSON.parse(await readFile(join(hub.dataDir, 'config.json'), 'utf8')).hub.maxElements).toBe(20);
    } finally {
      await hub.close();
    }
  });

  it('un token de CHARTSIA_TOKEN se muestra como de la variable', async () => {
    const hub = await startHub({ CHARTSIA_TOKEN: TOKEN });
    try {
      expect(await body(await fetch(`${hub.url}/api/hub/config`, { headers: { authorization: `Bearer ${TOKEN}` } }))).toMatchObject({ token: { value: TOKEN, source: "env" } });
    } finally {
      await hub.close();
    }
  });
});

describe('arranque con la configuración guardada', () => {
  it('el hub usa la carpeta, el límite y el token de config.json', async () => {
    const hub = await startHubFromFile({ maxElements: 9, token: TOKEN, network: true }, { CHARTSIA_HOST: '127.0.0.1' });
    try {
      // CHARTSIA_HOST gana sobre network: el hub escucha en loopback y lo informa.
      const config = await body(await fetch(`${hub.url}/api/hub/config`));
      expect(config).toMatchObject({ maxElements: { value: 9, source: 'file' }, network: { value: false, source: 'env', running: false }, token: { value: TOKEN, source: 'file' } });
    } finally {
      await hub.close();
    }
  });
});

describe('auth de /api/hub/config fuera de loopback', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_TOKEN: TOKEN });
  });
  afterAll(() => hub.close());

  it('exige el token, y /api/health sigue siendo público', async () => {
    expect((await fetch(`${hub.url}/api/hub/config`)).status).toBe(401);
    expect((await fetch(`${hub.url}/api/hub/config`, { method: 'PUT', body: '{}' })).status).toBe(401);
    expect((await fetch(`${hub.url}/api/hub/token`, { method: 'POST' })).status).toBe(401);
    const res = await fetch(`${hub.url}/api/hub/config`, { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ network: { value: true, running: true, source: 'env' } });
    expect((await fetch(`${hub.url}/api/health`)).status).toBe(200);
  });

  it('la respuesta pública de salud no incluye la configuración ni el token', async () => {
    expect(JSON.stringify(await body(await fetch(`${hub.url}/api/health`)))).not.toContain(TOKEN);
  });
});
