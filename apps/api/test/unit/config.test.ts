import { describe, expect, it } from 'vitest';
import { isLoopback, loadConfig } from '../../src/config/config.js';

describe('config', () => {
  it('usa valores por defecto en loopback sin exigir token', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3333);
    expect(config.host).toBe('127.0.0.1');
    expect(config.maxElements).toBe(500);
    expect(config.maxRequestBytes).toBe(8 * 1024 * 1024);
    expect(config.publicUrl).toBe('http://127.0.0.1:3333');
    expect(config.authRequired).toBe(false);
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
});
