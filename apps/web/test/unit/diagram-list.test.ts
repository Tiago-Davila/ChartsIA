import { describe, expect, it } from 'vitest';
import { agruparPorProyecto, filtrarDiagramas, type DiagramListItem } from '../../src/app/DiagramList';

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

describe('agruparPorProyecto', () => {
  const proyectos = [{ id: 'pr_1', name: 'Tienda', createdAt: '2026-01-01' }];
  const lista = [
    { ...item('Viejo', '2024-01-01'), projectId: 'pr_1' },
    { ...item('Nuevo', '2026-01-01'), projectId: 'pr_1' },
    item('Suelto', '2025-01-01'),
    { ...item('Huérfano', '2025-06-01'), projectId: 'pr_borrado' },
  ];

  it('agrupa por proyecto, ordena por fecha y deja el resto en "Sin proyecto"', () => {
    const secciones = agruparPorProyecto(lista, proyectos, '');
    expect(secciones.map((s) => [s.nombre, s.diagramas.map((d) => d.title)])).toEqual([
      ['Tienda', ['Nuevo', 'Viejo']],
      ['Sin proyecto', ['Huérfano', 'Suelto']],
    ]);
  });

  it('al buscar filtra dentro de las secciones y oculta las vacías', () => {
    const secciones = agruparPorProyecto(lista, proyectos, 'suelto');
    expect(secciones.map((s) => s.nombre)).toEqual(['Sin proyecto']);
  });
});
