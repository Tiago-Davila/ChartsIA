import { describe, expect, it } from 'vitest';
import { diagramPath, parseRoute, slugify } from '../../src/app/routes';

describe('rutas', () => {
  it.each([
    ['/', { name: 'home' }],
    ['/d/dg_abcdefghijkl', { name: 'diagram', diagramId: 'dg_abcdefghijkl' }],
    ['/d/dg_abcdefghijkl/', { name: 'diagram', diagramId: 'dg_abcdefghijkl' }],
    ['/d/biblioteca-abcdefghijkl', { name: 'diagram', diagramId: 'dg_abcdefghijkl' }],
    ['/d/diagrama-de-clases-pedidos-abcdefghijkl/', { name: 'diagram', diagramId: 'dg_abcdefghijkl' }],
    ['/d/sin-id-valido', { name: 'diagram', diagramId: 'sin-id-valido' }],
    ['/config', { name: 'config', section: 'general' }],
    ['/config/mcp', { name: 'config', section: 'mcp' }],
    ['/otra', { name: 'home' }],
  ])('%s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('diagramPath es inverso de parseRoute, con o sin título', () => {
    expect(parseRoute(diagramPath('dg_abcdefghijkl', 'Biblioteca'))).toEqual({ name: 'diagram', diagramId: 'dg_abcdefghijkl' });
    expect(parseRoute(diagramPath('dg_abcdefghijkl'))).toEqual({ name: 'diagram', diagramId: 'dg_abcdefghijkl' });
  });

  it('diagramPath usa el slug del título y la parte única del id', () => {
    expect(diagramPath('dg_gvqrp4kdubn3', 'Biblioteca')).toBe('/d/biblioteca-gvqrp4kdubn3');
    expect(diagramPath('dg_gvqrp4kdubn3', '')).toBe('/d/diagrama-gvqrp4kdubn3');
  });
});

describe('slugify', () => {
  it.each([
    ['Biblioteca', 'biblioteca'],
    ['Diagrama de Clases: Pedidos!', 'diagrama-de-clases-pedidos'],
    ['Año nuevo ñandú', 'ano-nuevo-nandu'],
    ['  --Dos   espacios--  ', 'dos-espacios'],
    ['Pedidos 2026', 'pedidos-2026'],
    ['', 'diagrama'],
    ['日本語', 'diagrama'],
  ])('%j -> %s', (titulo, slug) => {
    expect(slugify(titulo)).toBe(slug);
  });
});
