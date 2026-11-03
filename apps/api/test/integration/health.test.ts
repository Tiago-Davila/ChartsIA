import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { loadConfig } from '../../src/config/config.js';
import { JsonLogger } from '../../src/common/logger.js';

describe('GET /api/health', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp(loadConfig({ CHARTSIA_DATA_DIR: '/tmp/chartsia-health-test' }), { logger: new JsonLogger({ level: 'error' }) });
  });
  afterAll(() => app.close());

  it('responde ok con versión', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', version: expect.any(String) });
  });
});

describe('GET /api/hub', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp(loadConfig({ CHARTSIA_DATA_DIR: '/tmp/chartsia-hub-test', CHARTSIA_PORT: '24399' }), { logger: new JsonLogger({ level: 'error' }) });
  });
  afterAll(() => app.close());

  it('devuelve versión, puerto y carpeta de datos', async () => {
    const res = await request(app.getHttpServer()).get('/api/hub').expect(200);
    expect(res.body).toEqual({ version: expect.any(String), port: 24399, dataDir: '/tmp/chartsia-hub-test' });
  });
});
