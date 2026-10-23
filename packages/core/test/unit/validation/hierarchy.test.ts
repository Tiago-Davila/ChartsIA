import { describe, expect, it } from 'vitest';
import type { DiagramInput } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { c4ContainerDiagram, classDiagram, codes } from '../../support/fixtures.js';
import { pngDataUrl } from '../../support/images.js';

const errs = (d: DiagramInput) => {
  const res = validateDiagram(d);
  return res.ok ? [] : res.errors;
};

describe('INHERITANCE_CYCLE', () => {
  it('detecta un ciclo de herencia', () => {
    const d = classDiagram();
    d.elements.push({ id: 'C', kind: 'class', name: 'C', attributes: [], operations: [] });
    d.relations.push(
      { id: 'h1', kind: 'inheritance', source: 'Libro', target: 'Autor' },
      { id: 'h2', kind: 'inheritance', source: 'Autor', target: 'C' },
      { id: 'h3', kind: 'inheritance', source: 'C', target: 'Libro' },
    );
    const err = errs(d).find((e) => e.code === 'INHERITANCE_CYCLE');
    expect(err).toBeDefined();
    expect(err?.message).toMatch(/Libro|Autor|C/);
  });

  it('detecta la herencia de sí misma', () => {
    const d = classDiagram();
    d.relations.push({ id: 'h1', kind: 'inheritance', source: 'Libro', target: 'Libro' });
    expect(codes(errs(d))).toContain('INHERITANCE_CYCLE');
  });

  it('acepta jerarquías sin ciclos (diamante)', () => {
    const d = classDiagram();
    d.elements.push(
      { id: 'C', kind: 'class', name: 'C', attributes: [], operations: [] },
      { id: 'D', kind: 'class', name: 'D', attributes: [], operations: [] },
    );
    d.relations.push(
      { id: 'h1', kind: 'inheritance', source: 'C', target: 'Libro' },
      { id: 'h2', kind: 'inheritance', source: 'D', target: 'Libro' },
      { id: 'h3', kind: 'inheritance', source: 'Autor', target: 'C' },
      { id: 'h4', kind: 'inheritance', source: 'Autor', target: 'D' },
    );
    expect(codes(errs(d))).not.toContain('INHERITANCE_CYCLE');
  });
});

describe('PARENT_CYCLE', () => {
  it('detecta ciclos de anidamiento', () => {
    const d = classDiagram();
    d.elements.push(
      { id: 'p1', kind: 'package', name: 'p1', parentId: 'p2' },
      { id: 'p2', kind: 'package', name: 'p2', parentId: 'p1' },
    );
    expect(codes(errs(d))).toContain('PARENT_CYCLE');
  });

  it('un grupo no puede ser su propio padre', () => {
    const d = classDiagram();
    d.elements.push({ id: 'p1', kind: 'package', name: 'p1', parentId: 'p1' });
    expect(codes(errs(d))).toContain('PARENT_CYCLE');
  });

  it('detecta ciclos de frames antes de que una cadena de component quede atrapada', () => {
    const res = errs({
      type: 'c4-component', title: 'API', relations: [],
      elements: [
        { id: 'container', kind: 'boundary', name: 'API', boundaryType: 'container' },
        { id: 'outer', kind: 'frame', name: 'Exterior', parentId: 'inner' },
        { id: 'inner', kind: 'frame', name: 'Interior', parentId: 'outer' },
        { id: 'ctrl', kind: 'component', name: 'Controller', parentId: 'inner' },
      ],
    } as DiagramInput);
    expect(codes(res)).toContain('PARENT_CYCLE');
    expect(codes(res)).not.toContain('INVALID_PARENT');
  });
});

describe('INVALID_PARENT', () => {
  it('parentId debe ser un grupo', () => {
    const d = classDiagram();
    d.elements[1]!.parentId = 'Libro';
    expect(errs(d).map((e) => [e.code, e.path])).toContainEqual(['INVALID_PARENT', '/elements/1/parentId']);
  });

  it('package contiene elementos de clases (incluidos paquetes anidados)', () => {
    const d = classDiagram();
    d.elements.push(
      { id: 'pkg', kind: 'package', name: 'pkg' },
      { id: 'sub', kind: 'package', name: 'sub', parentId: 'pkg' },
    );
    d.elements[0]!.parentId = 'sub';
    expect(errs(d)).toEqual([]);
  });

  it('un package también contiene figuras generales', () => {
    const d = classDiagram();
    d.elements.push(
      { id: 'pkg', kind: 'package', name: 'pkg' },
      { id: 'nube', kind: 'figure', name: 'Nube', shape: 'cloud', parentId: 'pkg' },
    );
    expect(errs(d)).toEqual([]);
  });

  it('un package también contiene trazos libres', () => {
    const d = classDiagram();
    d.elements.push(
      { id: 'pkg', kind: 'package', name: 'pkg' },
      { id: 'trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 0, y: 0 }, { x: 12, y: 8 }], strokeColor: '#1f2933', strokeWidth: 2, parentId: 'pkg' },
    );
    expect(errs(d)).toEqual([]);
  });

  it('un package puede contener un frame y este puede anidar otros grupos', () => {
    const d = classDiagram({
      elements: [
        { id: 'pkg', kind: 'package', name: 'Paquete' },
        { id: 'outer', kind: 'frame', name: 'Exterior', parentId: 'pkg' },
        { id: 'inner', kind: 'frame', name: 'Interior', parentId: 'outer' },
        { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [], parentId: 'inner' },
      ],
      relations: [],
    });
    expect(errs(d)).toEqual([]);
  });

  it('un frame ER puede contener imágenes, trazos y elementos del diagrama', () => {
    const d: DiagramInput = {
      type: 'er', title: 'Tienda', relations: [],
      elements: [
        { id: 'marco', kind: 'frame', name: 'Contexto' },
        { id: 'cliente', kind: 'entity', name: 'Cliente', parentId: 'marco' },
        { id: 'logo', kind: 'image', name: 'Logo', src: pngDataUrl(), parentId: 'marco' },
        { id: 'trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 0, y: 0 }, { x: 12, y: 8 }], strokeColor: '#1f2933', strokeWidth: 2, parentId: 'marco' },
      ],
    };
    expect(errs(d)).toEqual([]);
  });

  it('en c4-component un component debe estar dentro de un boundary container', () => {
    const base = {
      type: 'c4-component' as const,
      title: 'API',
      relations: [],
    };
    const ok = errs({
      ...base,
      elements: [
        { id: 'api', kind: 'boundary', name: 'API', boundaryType: 'container' },
        { id: 'c1', kind: 'component', name: 'Ctrl', parentId: 'api' },
      ],
    } as DiagramInput);
    expect(ok).toEqual([]);

    const throughFrames = errs({
      ...base,
      elements: [
        { id: 'api', kind: 'boundary', name: 'API', boundaryType: 'container' },
        { id: 'outer', kind: 'frame', name: 'Exterior', parentId: 'api' },
        { id: 'inner', kind: 'frame', name: 'Interior', parentId: 'outer' },
        { id: 'c1', kind: 'component', name: 'Ctrl', parentId: 'inner' },
      ],
    } as DiagramInput);
    expect(throughFrames).toEqual([]);

    const sinPadre = errs({
      ...base,
      elements: [{ id: 'c1', kind: 'component', name: 'Ctrl' }],
    } as DiagramInput);
    expect(sinPadre.map((e) => e.code)).toContain('INVALID_PARENT');

    const padreSistema = errs({
      ...base,
      elements: [
        { id: 'sys', kind: 'boundary', name: 'Sys', boundaryType: 'system' },
        { id: 'c1', kind: 'component', name: 'Ctrl', parentId: 'sys' },
      ],
    } as DiagramInput);
    expect(padreSistema.map((e) => [e.code, e.path])).toContainEqual(['INVALID_PARENT', '/elements/1/parentId']);
  });

  it('un C4 válido no tiene errores', () => {
    expect(errs(c4ContainerDiagram())).toEqual([]);
  });
});
