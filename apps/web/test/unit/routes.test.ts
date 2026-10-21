import { describe, expect, it } from 'vitest';
import { diagramPath, parseRoute } from '../../src/app/routes';

describe('rutas', () => {
  it.each([
    ['/', { name: 'home' }],
    ['/d/dg_abcdefghijkl', { name: 'diagram', diagramId: 'dg_abcdefghijkl' }],
    ['/d/dg_abcdefghijkl/', { name: 'diagram', diagramId: 'dg_abcdefghijkl' }],
    ['/config', { name: 'config' }],
    ['/otra', { name: 'home' }],
  ])('%s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('diagramPath es inverso de parseRoute', () => {
    expect(parseRoute(diagramPath('dg_x y'))).toEqual({ name: 'diagram', diagramId: 'dg_x y' });
  });
});
