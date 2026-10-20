import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/bootstrap.js';
import { loadConfig } from '../../src/config/config.js';
import { JsonLogger } from '../../src/common/logger.js';

describe('GET /api/health', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp(loadConfig({}), new JsonLogger({ level: 'error' }));
    await app.init();
  });
  afterAll(() => app.close());

  it('responde ok con versión', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', version: expect.any(String) });
  });
});
