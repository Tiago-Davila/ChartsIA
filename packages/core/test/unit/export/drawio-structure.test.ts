import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { fixtureNames, loadFixture } from '../../support/golden-fixtures.js';
import { findAll, parseXml, type XmlNode } from '../../support/xml.js';

interface Cell {
  id: string;
  cell: XmlNode;
}

/** Celdas del modelo: cada `mxCell` suelto o el `mxCell` interior de un `object`, con el id del contenedor. */
function cellsOf(root: XmlNode): Cell[] {
  return root.children.map((node) => {
    if (node.name === 'object') return { id: node.attrs.id!, cell: node.children.find((c) => c.name === 'mxCell')! };
    return { id: node.attrs.id!, cell: node };
  });
}

/** Claves del estilo de draw.io (`clave=valor;` o el nombre de una forma suelta). */
function styleKeys(style: string): string[] {
  return style.split(';').filter(Boolean).map((token) => (token.includes('=') ? token.slice(0, token.indexOf('=')) : token));
}

describe.each(fixtureNames())('estructura de draw.io: %s', (name) => {
  async function load() {
    const xml = exportDiagram(await loadFixture(name), 'drawio').content;
    const file = parseXml(xml);
    const root = findAll(file, 'root')[0]!;
    return { file, cells: cellsOf(root), root };
  }

  it('es un mxfile con un diagrama y un modelo de grafo', async () => {
    const { file } = await load();
    expect(file.name).toBe('mxfile');
    expect(file.children.map((c) => c.name)).toEqual(['diagram']);
    expect(file.children[0]!.children.map((c) => c.name)).toEqual(['mxGraphModel']);
  });

  it('los ids de las celdas son únicos y existen las celdas 0 y 1', async () => {
    const { cells, root } = await load();
    const ids = cells.map((c) => c.id);
    expect(root.children.every((node) => node.name === 'mxCell' || node.name === 'object')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(cells.find((c) => c.id === '0')?.cell.attrs.parent).toBeUndefined();
    expect(cells.find((c) => c.id === '1')?.cell.attrs.parent).toBe('0');
  });

  it('cada padre existe, no hay ciclos y solo las aristas tienen hijos de tipo etiqueta', async () => {
    const { cells } = await load();
    const byId = new Map(cells.map((c) => [c.id, c.cell]));
    for (const { id, cell } of cells) {
      if (id === '0') continue;
      const parent = cell.attrs.parent!;
      expect(byId.has(parent), `la celda ${id} apunta al padre inexistente ${parent}`).toBe(true);
      const seen = new Set<string>([id]);
      for (let p: string | undefined = parent; p && p !== '0'; p = byId.get(p)!.attrs.parent) {
        expect(seen.has(p), `ciclo de padres en ${id}`).toBe(false);
        seen.add(p);
      }
      if (byId.get(parent)!.attrs.edge === '1') expect(cell.attrs.vertex, `${id} cuelga de una arista`).toBe('1');
    }
  });

  it('las aristas conectan celdas que son vértices y los vértices tienen geometría válida', async () => {
    const { cells } = await load();
    const byId = new Map(cells.map((c) => [c.id, c.cell]));
    for (const { id, cell } of cells) {
      if (id === '0' || id === '1') continue;
      expect(['1'], `${id} debe ser vértice o arista`).toContain(cell.attrs.vertex ?? cell.attrs.edge);
      const geometry = cell.children.find((c) => c.name === 'mxGeometry')!;
      expect(geometry, `${id} sin mxGeometry`).toBeDefined();
      if (cell.attrs.edge === '1') {
        expect(cell.attrs.vertex).toBeUndefined();
        expect(geometry.attrs.relative).toBe('1');
        for (const end of [cell.attrs.source, cell.attrs.target]) {
          expect(end, `la arista ${id} no tiene extremo`).toBeDefined();
          expect(byId.get(end!)?.attrs.vertex, `la arista ${id} apunta a ${end}, que no es un vértice`).toBe('1');
        }
        for (const point of findAll(geometry, 'mxPoint')) {
          for (const key of ['x', 'y']) expect(Number.isFinite(Number(point.attrs[key]))).toBe(true);
        }
      } else if (geometry.attrs.relative === '1') {
        // Etiqueta de un extremo de la arista: coordenada relativa al camino.
        expect(Number.isFinite(Number(geometry.attrs.x))).toBe(true);
      } else {
        for (const key of ['x', 'y', 'width', 'height']) expect(Number.isFinite(Number(geometry.attrs[key])), `${id}.${key}`).toBe(true);
        expect(Number(geometry.attrs.width), `${id} sin ancho`).toBeGreaterThan(0);
        expect(Number(geometry.attrs.height), `${id} sin alto`).toBeGreaterThan(0);
      }
    }
  });

  it('los estilos no repiten claves y los puertos de las aristas están entre 0 y 1', async () => {
    const { cells } = await load();
    for (const { id, cell } of cells) {
      const style = cell.attrs.style;
      if (style === undefined) continue;
      // Algunos valores llevan `;` dentro de corchetes (p. ej. `points=[[0,0,0],...]`), que no separan claves.
      const keys = styleKeys(style.replace(/\[[^\]]*\]/g, ''));
      expect(new Set(keys).size, `claves repetidas en el estilo de ${id}: ${style}`).toBe(keys.length);
      for (const match of style.matchAll(/\b(exit|entry)([XY])=([^;]+);/g)) {
        const value = Number(match[3]);
        expect(value, `${id}: ${match[1]}${match[2]}`).toBeGreaterThanOrEqual(0);
        expect(value, `${id}: ${match[1]}${match[2]}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
