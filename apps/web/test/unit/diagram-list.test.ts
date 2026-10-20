import { describe, expect, it } from 'vitest';
import { filtrarDiagramas, type DiagramListItem } from '../../src/app/DiagramList';

const item = (title: string, updatedAt: string): DiagramListItem => ({
  diagramId: title,
  type: 'class',
  title,
  revision: 1,
  updatedAt,
});

describe('filtrarDiagramas', () => {
  const lista = [item('Antiguo', '2024-01-01'), item('Frávega - Sucursales', '2025-01-01'), item('Nuevo', '2026-01-01')];

  it('ordena por última modificación, el más reciente primero', () => {
    expect(filtrarDiagramas(lista, '').map((d) => d.title)).toEqual(['Nuevo', 'Frávega - Sucursales', 'Antiguo']);
  });

  it('filtra sin distinguir mayúsculas ni acentos', () => {
    expect(filtrarDiagramas(lista, ' FRAVEGA ').map((d) => d.title)).toEqual(['Frávega - Sucursales']);
  });
});
