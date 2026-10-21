import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { JsonLogger } from '../../src/common/logger.js';
import { loadConfig } from '../../src/config/config.js';

describe('app web servida desde una carpeta que empieza con punto', () => {
  let app: INestApplication;
  let tmp: string;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'chartsia-web-'));
    const dist = join(tmp, '.oculta', 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>ChartsIA</title>');
    writeFileSync(join(dist, 'assets', 'app.js'), 'console.log("app");');
    const config = loadConfig({ CHARTSIA_DATA_DIR: join(tmp, 'datos'), CHARTSIA_WEB_DIST: dist });
    app = await createApp(config, { logger: new JsonLogger({ level: 'error' }) });
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
});
