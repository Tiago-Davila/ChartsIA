import { describe, expect, it } from 'vitest';
import { DiagramLock } from '../../src/diagrams/persistence/diagram-lock.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('DiagramLock', () => {
  it('serializa operaciones del mismo diagrama', async () => {
    const lock = new DiagramLock();
    const log: string[] = [];
    const task = (name: string, ms: number) =>
      lock.run('d1', async () => {
        log.push(`${name}:start`);
        await sleep(ms);
        log.push(`${name}:end`);
        return name;
      });
    const results = await Promise.all([task('a', 20), task('b', 1), task('c', 5)]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('ejecuta en paralelo diagramas distintos', async () => {
    const lock = new DiagramLock();
    const log: string[] = [];
    await Promise.all([
      lock.run('d1', async () => {
        log.push('d1:start');
        await sleep(20);
        log.push('d1:end');
      }),
      lock.run('d2', async () => {
        log.push('d2:start');
        await sleep(1);
        log.push('d2:end');
      }),
    ]);
    expect(log.indexOf('d2:end')).toBeLessThan(log.indexOf('d1:end'));
  });

  it('un fallo no bloquea las operaciones siguientes', async () => {
    const lock = new DiagramLock();
    await expect(lock.run('d1', async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(lock.run('d1', async () => 'ok')).resolves.toBe('ok');
    expect(lock.size).toBe(0);
  });
});
