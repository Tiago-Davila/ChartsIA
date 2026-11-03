import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLoopback, loadConfig as loadConfigConEntorno } from '../../src/config/config.js';

const dir = mkdtempSync(join(tmpdir(), 'chartsia-config-test-'));
const sinArchivo = join(dir, 'no-existe.json');
// Los tests nunca leen el config.json real de la persona.
const loadConfig = (env: NodeJS.ProcessEnv) => loadConfigConEntorno({ CHARTSIA_CONFIG_FILE: sinArchivo, ...env });

describe('config', () => {
  it('usa valores por defecto en loopback sin exigir token', () => {
    const config = loadConfig({});
    expect(config.port).toBe(24278);
    expect(config.host).toBe('127.0.0.1');
    expect(config.maxElements).toBe(500);
    expect(config.maxRequestBytes).toBe(8 * 1024 * 1024);
    expect(config.publicUrl).toBe('http://chartsia.localhost:24278');
    expect(config.authRequired).toBe(false);
  });

  it('usa el host configurado en la dirección de la app, salvo en loopback', () => {
    expect(loadConfig({ CHARTSIA_HOST: '192.168.1.10' }).publicUrl).toBe('http://192.168.1.10:24278');
    expect(loadConfig({ CHARTSIA_HOST: '0.0.0.0', CHARTSIA_PORT: '4000' }).publicUrl).toBe('http://chartsia.localhost:4000');
  });

  it('exige token fuera de loopback', () => {
    expect(loadConfig({ CHARTSIA_HOST: '0.0.0.0' }).authRequired).toBe(true);
  });

  it('rechaza enteros inválidos', () => {
    expect(() => loadConfig({ CHARTSIA_PORT: 'abc' })).toThrow(/CHARTSIA_PORT/);
  });

  it.each([
    ['127.0.0.1', true],
    ['127.1.2.3', true],
    ['localhost', true],
    ['::1', true],
    ['0.0.0.0', false],
    ['192.168.1.10', false],
  ])('isLoopback(%s) = %s', (host, expected) => {
    expect(isLoopback(host)).toBe(expected);
  });

  describe('config.json (clave hub)', () => {
    const archivo = (hub: unknown) => {
      const file = join(dir, `${Math.random().toString(36).slice(2)}.json`);
      writeFileSync(file, JSON.stringify({ otro: 1, hub }));
      return file;
    };
    const dataDir = join(dir, 'datos');

    it('usa los valores del archivo e indica que vienen de él', () => {
      const config = loadConfigConEntorno({ CHARTSIA_CONFIG_FILE: archivo({ dataDir, maxElements: 20, network: true, token: 'abc' }) });
      expect(config).toMatchObject({ dataDir, maxElements: 20, host: '0.0.0.0', token: 'abc', authRequired: true });
      expect(config.sources).toEqual({ dataDir: 'file', maxElements: 'file', network: 'file', token: 'file' });
    });

    it('las variables de entorno tienen prioridad sobre el archivo', () => {
      const env = { CHARTSIA_CONFIG_FILE: archivo({ dataDir, maxElements: 20, network: true, token: 'abc' }), CHARTSIA_DATA_DIR: join(dir, 'otra'), CHARTSIA_MAX_ELEMENTS: '7', CHARTSIA_HOST: '127.0.0.1', CHARTSIA_TOKEN: 'xyz' };
      const config = loadConfigConEntorno(env);
      expect(config).toMatchObject({ dataDir: join(dir, 'otra'), maxElements: 7, host: '127.0.0.1', token: 'xyz', authRequired: false });
      expect(config.sources).toEqual({ dataDir: 'env', maxElements: 'env', network: 'env', token: 'env' });
    });

    it('la ruta de config.json no depende de la carpeta de datos del archivo', () => {
      const config = loadConfigConEntorno({ CHARTSIA_CONFIG_FILE: archivo({ dataDir }) });
      expect(config.configFile).not.toContain('datos');
    });

    it('ignora valores inválidos y deja los por defecto', () => {
      const config = loadConfigConEntorno({ CHARTSIA_CONFIG_FILE: archivo({ dataDir: 3, maxElements: -1, network: 'si', token: '' }) });
      expect(config).toMatchObject({ maxElements: 500, host: '127.0.0.1', token: undefined });
      expect(config.sources).toEqual({ dataDir: 'default', maxElements: 'default', network: 'default', token: 'default' });
    });
  });
});
