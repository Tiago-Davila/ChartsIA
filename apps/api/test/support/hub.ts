import { mkdtemp, rm } from 'node:fs/promises';
import { type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { createApp } from '../../src/bootstrap.js';
import { JsonLogger } from '../../src/common/logger.js';
import { loadConfig } from '../../src/config/config.js';

export interface TestHub {
  app: INestApplication;
  url: string;
  port: number;
  dataDir: string;
  logs: string[];
  announced: string[];
  close(): Promise<void>;
}

/** Levanta el hub real en un puerto libre con un directorio de datos temporal. */
export async function startHub(env: Record<string, string> = {}): Promise<TestHub> {
  const dataDir = await mkdtemp(join(tmpdir(), 'chartsia-hub-'));
  const logs: string[] = [];
  const announced: string[] = [];
  // Puerto 0 ⇒ el sistema elige uno libre; la URL pública se fija tras escuchar.
  const config = loadConfig({ CHARTSIA_DATA_DIR: dataDir, CHARTSIA_PORT: '1', ...env });
  const app = await createApp(config, {
    logger: new JsonLogger({ level: 'debug', write: (l) => logs.push(l) }),
    announce: (t) => announced.push(t),
  });
  await app.listen(0, config.host);
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;
  return {
    app,
    url,
    port,
    dataDir,
    logs,
    announced,
    close: async () => {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

export const sampleDiagram = {
  type: 'class',
  title: 'Biblioteca',
  elements: [
    { id: 'Libro', kind: 'class', name: 'Libro', attributes: [{ name: 'isbn', type: 'String', visibility: '-' }], operations: [] },
    { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [] },
  ],
  relations: [{ id: 'r1', kind: 'association', source: 'Libro', target: 'Autor' }],
};

/** Cuerpo JSON de una respuesta, sin tipar (los tests comprueban su forma). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function body(res: Response): Promise<any> {
  return res.json();
}
