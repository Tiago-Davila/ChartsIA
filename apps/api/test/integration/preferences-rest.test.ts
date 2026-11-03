import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '@chartsia/core/model';
import { body, startHub, type TestHub } from '../support/hub.js';

const TOKEN = 'token-de-prueba-suficientemente-largo-123456';

describe('API REST /api/preferences', () => {
  let hub: TestHub;
  const json = (path: string, init: RequestInit = {}) =>
    fetch(`${hub.url}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const configFile = () => join(hub.dataDir, 'config.json');

  beforeAll(async () => {
    hub = await startHub();
  });
  afterAll(() => hub.close());

  it('GET devuelve las preferencias por defecto si no hay config.json', async () => {
    const res = await json('/api/preferences');
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual(DEFAULT_PREFERENCES);
  });

  it('PUT guarda cambios parciales, conserva el resto de config.json y sobrevive a una lectura nueva', async () => {
    await writeFile(configFile(), JSON.stringify({ otro: { valor: 1 } }));
    const res = await json('/api/preferences', { method: 'PUT', body: JSON.stringify({ direction: 'right', uml: { types: false } }) });
    expect(res.status).toBe(200);
    expect(await body(res)).toMatchObject({ direction: 'right', elementSpacing: 'normal', uml: { types: false, methods: true } });
    const file = JSON.parse(await readFile(configFile(), 'utf8'));
    expect(file.otro).toEqual({ valor: 1 });
    expect(file.diagrams.direction).toBe('right');
    expect(await body(await json('/api/preferences'))).toMatchObject({ direction: 'right', uml: { types: false } });
  });

  it('PUT con campos inválidos ⇒ 422 y no cambia nada', async () => {
    const res = await json('/api/preferences', { method: 'PUT', body: JSON.stringify({ direction: 'diagonal' }) });
    expect(res.status).toBe(422);
    expect((await body(res)).errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION' });
    expect(await body(await json('/api/preferences'))).toMatchObject({ direction: 'right' });
  });

  it('un config.json ilegible o con valores inválidos vale como las preferencias por defecto', async () => {
    await writeFile(configFile(), '{ no es json');
    expect(await body(await json('/api/preferences'))).toEqual(DEFAULT_PREFERENCES);
    await writeFile(configFile(), JSON.stringify({ diagrams: { direction: 'diagonal' } }));
    expect(await body(await json('/api/preferences'))).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('auth de /api/preferences fuera de loopback', () => {
  let hub: TestHub;
  beforeAll(async () => {
    hub = await startHub({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_TOKEN: TOKEN });
  });
  afterAll(() => hub.close());

  it('exige el token igual que el resto de /api', async () => {
    expect((await fetch(`${hub.url}/api/preferences`)).status).toBe(401);
    expect((await fetch(`${hub.url}/api/preferences`, { method: 'PUT', body: '{}' })).status).toBe(401);
    expect((await fetch(`${hub.url}/api/preferences`, { headers: { authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
  });
});
