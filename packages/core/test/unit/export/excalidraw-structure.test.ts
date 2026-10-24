import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { fixtureNames, loadFixture } from '../../support/golden-fixtures.js';

type El = Record<string, unknown> & { id: string; type: string; boundElements: { type: string; id: string }[] | null };

const COMMON = [
  'id', 'type', 'x', 'y', 'width', 'height', 'angle', 'strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle',
  'roughness', 'opacity', 'groupIds', 'frameId', 'roundness', 'seed', 'version', 'versionNonce', 'isDeleted', 'boundElements',
  'updated', 'link', 'locked', 'index',
];
const TEXT = ['text', 'originalText', 'fontSize', 'fontFamily', 'textAlign', 'verticalAlign', 'containerId', 'lineHeight', 'autoResize'];
const LINEAR = ['points', 'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead', 'lastCommittedPoint'];

describe.each(fixtureNames())('estructura de Excalidraw: %s', (name) => {
  async function load() {
    const file = JSON.parse(exportDiagram(await loadFixture(name), 'excalidraw').content);
    const elements = file.elements as El[];
    return { file, elements, byId: new Map(elements.map((e) => [e.id, e])) };
  }

  it('es un archivo excalidraw versión 2 con elementos, appState y files', async () => {
    const { file } = await load();
    expect(file.type).toBe('excalidraw');
    expect(file.version).toBe(2);
    expect(Array.isArray(file.elements)).toBe(true);
    expect(file.elements.length).toBeGreaterThan(0);
    expect(typeof file.appState).toBe('object');
    // Cada archivo embebido es el de una imagen del diagrama, y cada imagen tiene su archivo.
    const fileIds = (file.elements as El[]).filter((e) => e.type === 'image').map((e) => e.fileId);
    expect(Object.keys(file.files).sort()).toEqual([...new Set(fileIds)].sort());
    for (const [id, entry] of Object.entries(file.files as Record<string, { id: string; dataURL: string }>)) {
      expect(entry.id).toBe(id);
      expect(entry.dataURL).toMatch(/^data:image\//);
    }
  });

  it('todos los elementos traen los campos obligatorios de su tipo, con números finitos', async () => {
    const { elements } = await load();
    for (const el of elements) {
      const required = [...COMMON, ...(el.type === 'text' ? TEXT : []), ...(el.type === 'line' || el.type === 'arrow' ? LINEAR : [])];
      for (const key of required) expect(el, `${el.id}: falta ${key}`).toHaveProperty(key);
      for (const key of ['x', 'y', 'width', 'height', 'angle', 'seed', 'version', 'versionNonce', 'updated']) {
        expect(Number.isFinite(el[key]), `${el.id}.${key}`).toBe(true);
      }
      expect(['rectangle', 'ellipse', 'text', 'line', 'arrow', 'image']).toContain(el.type);
      expect(el.isDeleted).toBe(false);
      expect(Array.isArray(el.groupIds)).toBe(true);
    }
  });

  it('los ids son únicos y los índices fraccionarios son únicos y crecientes', async () => {
    const { elements } = await load();
    expect(new Set(elements.map((e) => e.id)).size).toBe(elements.length);
    const indexes = elements.map((e) => e.index as string);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect([...indexes].sort()).toEqual(indexes);
  });

  it('los textos ligados y sus contenedores se declaran el uno al otro', async () => {
    const { elements, byId } = await load();
    for (const el of elements) {
      if (el.type === 'text' && el.containerId) {
        const container = byId.get(el.containerId as string);
        expect(container, `${el.id}: contenedor inexistente`).toBeDefined();
        expect(container!.boundElements, `${el.id}: el contenedor no lo declara`).toContainEqual({ type: 'text', id: el.id });
      }
      for (const bound of el.boundElements ?? []) {
        const target = byId.get(bound.id);
        expect(target, `${el.id}: boundElements apunta a ${bound.id}, que no existe`).toBeDefined();
        if (bound.type === 'text') expect(target!.containerId).toBe(el.id);
        else {
          expect(bound.type).toBe('arrow');
          expect(target!.type).toBe('arrow');
          const bindings = [target!.startBinding, target!.endBinding] as ({ elementId: string } | null)[];
          expect(bindings.some((b) => b?.elementId === el.id), `${el.id}: la flecha ${bound.id} no apunta de vuelta`).toBe(true);
        }
      }
    }
  });

  it('las flechas se vinculan solo a elementos que existen y que las declaran', async () => {
    const { elements, byId } = await load();
    for (const el of elements.filter((e) => e.type === 'arrow')) {
      for (const key of ['startBinding', 'endBinding']) {
        const binding = el[key] as { elementId: string } | null;
        if (!binding) continue;
        const target = byId.get(binding.elementId);
        expect(target, `${el.id}.${key}: elemento inexistente`).toBeDefined();
        expect(['rectangle', 'ellipse'], `${el.id}.${key}: ${target!.type} no admite vínculos`).toContain(target!.type);
        expect(target!.boundElements).toContainEqual({ type: 'arrow', id: el.id });
      }
    }
  });

  it('las líneas y flechas empiezan en [0,0], tienen al menos dos puntos y los polígonos se cierran', async () => {
    const { elements } = await load();
    for (const el of elements.filter((e) => e.type === 'line' || e.type === 'arrow')) {
      const points = el.points as number[][];
      expect(points.length, `${el.id}: pocos puntos`).toBeGreaterThanOrEqual(2);
      expect(points[0]).toEqual([0, 0]);
      for (const p of points) expect(p.length === 2 && p.every(Number.isFinite), `${el.id}: punto inválido`).toBe(true);
      if (el.polygon) expect(points[points.length - 1]).toEqual(points[0]);
    }
  });

  it('los textos tienen contenido, fuente válida y los ligados quedan centrados en su contenedor', async () => {
    const { elements, byId } = await load();
    for (const el of elements.filter((e) => e.type === 'text')) {
      expect((el.text as string).length, `${el.id}: texto vacío`).toBeGreaterThan(0);
      expect(el.fontSize as number).toBeGreaterThan(0);
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9]).toContain(el.fontFamily);
      expect(['left', 'center', 'right']).toContain(el.textAlign);
      expect(['top', 'middle', 'bottom']).toContain(el.verticalAlign);
      expect(el.width as number).toBeGreaterThan(0);
      expect(el.height as number).toBeGreaterThan(0);
      const container = el.containerId ? byId.get(el.containerId as string) : undefined;
      if (!container || container.type === 'arrow' || el.verticalAlign !== 'middle') continue;
      const center = (e: El, axis: 'x' | 'y', size: 'width' | 'height') => (e[axis] as number) + (e[size] as number) / 2;
      expect(Math.abs(center(el, 'x', 'width') - center(container, 'x', 'width')), `${el.id}: descentrado en x`).toBeLessThanOrEqual(1);
      expect(Math.abs(center(el, 'y', 'height') - center(container, 'y', 'height')), `${el.id}: descentrado en y`).toBeLessThanOrEqual(1);
    }
  });

  it('cada grupo tiene al menos dos elementos', async () => {
    const { elements } = await load();
    const sizes = new Map<string, number>();
    for (const el of elements) for (const g of el.groupIds as string[]) sizes.set(g, (sizes.get(g) ?? 0) + 1);
    for (const [group, size] of sizes) expect(size, `grupo ${group}`).toBeGreaterThanOrEqual(2);
  });
});
