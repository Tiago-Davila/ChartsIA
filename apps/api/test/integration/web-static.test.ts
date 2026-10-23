import { request as httpRequest } from 'node:http';
import { type AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { JsonLogger } from '../../src/common/logger.js';
import { loadConfig } from '../../src/config/config.js';

const SECRETO = 'contenido-secreto';

/** Pide una ruta cruda al servidor, sin que el cliente la normalice. */
function pedirCrudo(puerto: number, ruta: string): Promise<{ status: number; body: string }> {
  return new Promise((resolver, rechazar) => {
    const req = httpRequest({ host: '127.0.0.1', port: puerto, path: ruta }, (res) => {
      let body = '';
      res.on('data', (trozo) => (body += trozo));
      res.on('end', () => resolver({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', rechazar);
    req.end();
  });
}

describe('app web servida desde una carpeta que empieza con punto', () => {
  let app: INestApplication;
  let tmp: string;
  let puerto: number;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'chartsia-web-'));
    const dist = join(tmp, '.oculta', 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>ChartsIA</title>');
    writeFileSync(join(dist, 'assets', 'app.js'), 'console.log("app");');
    writeFileSync(join(dist, '.env'), SECRETO);
    writeFileSync(join(tmp, 'secreto.txt'), SECRETO);
    writeFileSync(join(tmp, '.oculta', 'secreto.txt'), SECRETO);
    const config = loadConfig({ CHARTSIA_DATA_DIR: join(tmp, 'datos'), CHARTSIA_WEB_DIST: dist });
    app = await createApp(config, { logger: new JsonLogger({ level: 'error' }) });
    await app.listen(0, '127.0.0.1');
    puerto = (app.getHttpServer().address() as AddressInfo).port;
  });
  afterAll(async () => {
    await app.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it.each(['/', '/d/abc', '/config'])('%s responde index.html', async (ruta) => {
    const res = await request(app.getHttpServer()).get(ruta).expect(200);
    expect(res.text).toContain('<title>ChartsIA</title>');
  });

  it('sirve los assets', async () => {
    const res = await request(app.getHttpServer()).get('/assets/app.js').expect(200);
    expect(res.text).toContain('console.log');
  });

  it('las rutas del hub que no existen siguen dando 404', async () => {
    await request(app.getHttpServer()).get('/api/no-existe').expect(404);
  });

  it.each([
    '/../secreto.txt',
    '/../../secreto.txt',
    '/%2e%2e/secreto.txt',
    '/%2e%2e/%2e%2e/secreto.txt',
    '/..%2fsecreto.txt',
    '/..%2f..%2fsecreto.txt',
  ])('no se puede salir de dist con %s', async (ruta) => {
    const res = await pedirCrudo(puerto, ruta);
    expect(res.body).not.toContain(SECRETO);
  });

  it('no sirve archivos ocultos de dist como /.env', async () => {
    const res = await request(app.getHttpServer()).get('/.env');
    expect(res.text).not.toContain(SECRETO);
  });
});
