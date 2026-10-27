import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportExcalidraw } from '../../src/export/excalidraw.js';
import { importExcalidraw, MAX_EXCALIDRAW_ELEMENTS, MAX_EXCALIDRAW_SOURCE_LENGTH } from '../../src/import/excalidraw.js';
import { layoutDiagram } from '../../src/layout/index.js';
import { DiagramInputSchema, type Diagram } from '../../src/model/index.js';
import { DomainValidationError } from '../../src/validation/errors.js';
import { validateDiagram } from '../../src/validation/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', `${name}.excalidraw`), 'utf8');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGM4H2zxX6NsxX8AE2IEn6hGtYAAAAAASUVORK5CYII=';

/** Errores de dominio que lanza el importador con una entrada inválida. */
function errorsOf(source: string) {
  try {
    importExcalidraw(source);
  } catch (error) {
    if (error instanceof DomainValidationError) return error.errors;
    throw error;
  }
  throw new Error('Se esperaba un error de importación.');
}

describe('importExcalidraw: golden de entrada', () => {
  it.each(['boceto', 'portapapeles'])('%s', async (name) => {
    const result = importExcalidraw(fixture(name));
    await expect(JSON.stringify(result, null, 2) + '\n').toMatchFileSnapshot(join(here, 'expected', `${name}.json`));
    expect(validateDiagram(result.diagram).ok).toBe(true);
  });
});

describe('importExcalidraw: mapeo', () => {
  const { diagram, warnings } = importExcalidraw(fixture('boceto'));
  const byId = (id: string) => diagram.elements.find((element) => element.id === id);

  it('traduce formas con su texto ligado, estilos y marcos', () => {
    expect(byId('api')).toMatchObject({
      kind: 'figure', shape: 'rectangle', name: 'API REST', parentId: 'marco1',
      style: { borderColor: '#1971c2', fillColor: '#a5d8ff', lineWidth: 'thick', fontColor: '#e03131', fontFamily: 'sans-serif', fontSize: 20 },
      layout: { x: 40, y: 60, width: 160, height: 80 },
    });
    expect(byId('bd')).toMatchObject({ kind: 'figure', shape: 'circle', name: 'BD', style: { fontFamily: 'monospace' } });
    expect(byId('rombo')).toMatchObject({ kind: 'figure', shape: 'diamond', style: { lineWidth: 'thin' } });
    expect(byId('marco1')).toMatchObject({ kind: 'frame', name: 'Cliente' });
    expect(byId('nota')).toMatchObject({ kind: 'text', name: 'Revisar con el equipo', layout: { x: 220, y: 320 } });
  });

  it('traduce la flecha con vínculos a un conector con etiqueta', () => {
    expect(diagram.relations).toEqual([
      { id: 'flecha1', kind: 'connector', source: 'api', target: 'bd', label: 'lee', dashed: true, style: { lineWidth: 'medium', fontFamily: 'handwritten', fontSize: 16 } },
    ]);
  });

  it('traduce líneas, dibujo libre e imágenes embebidas', () => {
    expect(byId('regla')).toMatchObject({ kind: 'drawing', strokeColor: '#f08c00', layout: { x: 40, y: 420 }, points: [{ x: 0, y: 0 }, { x: 100, y: 30 }, { x: 200, y: 0 }] });
    expect(byId('garabato')).toMatchObject({ kind: 'drawing', strokeWidth: 4 });
    expect(byId('foto')).toMatchObject({ kind: 'image', src: PNG });
    expect(byId('suelta')).toMatchObject({ kind: 'drawing' });
  });

  it('ignora lo borrado y avisa de lo que no puede traducir', () => {
    expect(byId('borrado')).toBeUndefined();
    expect(byId('incrustado')).toBeUndefined();
    expect(byId('sinArchivo')).toBeUndefined();
    expect(warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('embeddable'),
      expect.stringContaining('rotación'),
      expect.stringContaining('grupos'),
      expect.stringContaining('relleno'),
      expect.stringContaining('no unen dos elementos'),
      expect.stringContaining('imágenes'),
    ]));
  });

  it('acepta el formato del portapapeles y asigna ids nuevos cuando los de Excalidraw no son válidos', () => {
    const { diagram: pasted } = importExcalidraw(fixture('portapapeles'));
    expect(pasted.elements.map((element) => element.id)).toEqual(['Zr8u3nQ-b3Bj4tPz-OV9S', 'otro']);
    expect(pasted.relations[0]).toMatchObject({ id: 'Flecha1', source: 'Zr8u3nQ-b3Bj4tPz-OV9S', target: 'otro', arrowheads: 'both' });
    const numeric = importExcalidraw(JSON.stringify({ type: 'excalidraw', elements: [{ id: '1abc', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }] }));
    expect(numeric.diagram.elements[0]?.id).toBe('Figura1');
  });

  it('invierte la flecha que solo tiene punta al inicio y quita las puntas si no hay ninguna', () => {
    const rect = (id: string, x: number) => ({ id, type: 'rectangle', x, y: 0, width: 50, height: 50 });
    const arrow = (id: string, start: unknown, end: unknown) => ({
      id, type: 'arrow', x: 50, y: 25, width: 100, height: 0, points: [[0, 0], [100, 0]],
      startBinding: { elementId: 'A' }, endBinding: { elementId: 'B' }, startArrowhead: start, endArrowhead: end,
    });
    const { diagram: result } = importExcalidraw(JSON.stringify({
      type: 'excalidraw',
      elements: [rect('A', 0), rect('B', 150), arrow('inicio', 'arrow', null), arrow('ninguna', null, null)],
    }));
    expect(result.relations.map(({ id, source, target, arrowheads }) => ({ id, source, target, arrowheads }))).toEqual([
      { id: 'inicio', source: 'B', target: 'A', arrowheads: undefined },
      { id: 'ninguna', source: 'A', target: 'B', arrowheads: 'none' },
    ]);
  });
});

describe('importExcalidraw: errores y límites', () => {
  it('rechaza JSON inválido, otros formatos y elementos mal formados con code/path/message/hint', () => {
    for (const [source, path] of [
      ['{no es json', '/source'],
      [JSON.stringify({ type: 'excalidrawlib', library: [] }), '/source/type'],
      [JSON.stringify({ type: 'excalidraw' }), '/source/elements'],
      [JSON.stringify({ type: 'excalidraw', elements: [42] }), '/source/elements/0'],
      [JSON.stringify({ type: 'excalidraw', elements: [{ type: 'rectangle', x: 'a', y: 0 }] }), '/source/elements/0/x'],
    ] as const) {
      expect(errorsOf(source)[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path, message: expect.any(String), hint: expect.any(String) });
    }
  });

  it('aplica los límites de tamaño y de cantidad de elementos', () => {
    expect(errorsOf('x'.repeat(MAX_EXCALIDRAW_SOURCE_LENGTH + 1))[0]).toMatchObject({ code: 'LIMIT_EXCEEDED', path: '/source' });
    const many = Array.from({ length: MAX_EXCALIDRAW_ELEMENTS + 1 }, () => ({ type: 'rectangle', x: 0, y: 0 }));
    expect(errorsOf(JSON.stringify({ type: 'excalidraw', elements: many }))[0]).toMatchObject({ code: 'LIMIT_EXCEEDED', path: '/source/elements' });
  });

  it('no valida los elementos borrados', () => {
    const { diagram } = importExcalidraw(JSON.stringify({ type: 'excalidraw', elements: [{ type: 'rectangle', isDeleted: true }] }));
    expect(diagram.elements).toEqual([]);
  });
});

describe('ida y vuelta: exportar -> importar', () => {
  async function laidOut(): Promise<Diagram> {
    const input = DiagramInputSchema.parse({
      type: 'class',
      title: 'Ida y vuelta',
      elements: [
        { id: 'Pedido', kind: 'figure', shape: 'rectangle', name: 'Pedido', layout: { x: 40, y: 40 } },
        { id: 'Cliente', kind: 'figure', shape: 'oval', name: 'Cliente', layout: { x: 400, y: 40 }, style: { fillColor: '#a5d8ff', borderColor: '#1971c2', lineWidth: 'thick' } },
        { id: 'Circulo', kind: 'figure', shape: 'circle', name: 'Círculo', layout: { x: 40, y: 300 } },
        { id: 'Foto', kind: 'image', name: 'Foto', src: PNG, layout: { x: 400, y: 300 } },
        { id: 'Trazo', kind: 'drawing', name: 'Trazo', points: [{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 80, y: 0 }], strokeColor: '#e03131', strokeWidth: 4, layout: { x: 40, y: 500 } },
      ],
      relations: [
        { id: 'r1', kind: 'connector', source: 'Pedido', target: 'Cliente', label: 'hecho por' },
        { id: 'r2', kind: 'connector', source: 'Cliente', target: 'Foto', arrowheads: 'both', dashed: true },
        { id: 'r3', kind: 'connector', source: 'Circulo', target: 'Pedido', arrowheads: 'none' },
      ],
    });
    return layoutDiagram({ ...input, id: 'dg_goldengolden', revision: 1, createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' });
  }

  it('conserva elementos, relaciones y posiciones', async () => {
    const original = await laidOut();
    const { diagram } = importExcalidraw(exportExcalidraw(original));
    expect(diagram.elements.map((e) => [e.id, e.kind])).toEqual(original.elements.map((e) => [e.id, e.kind]));
    for (const element of original.elements) {
      const imported = diagram.elements.find((e) => e.id === element.id)!;
      // La imagen se exporta ajustada a su proporción dentro de su caja, así que se compara el centro.
      const center = (l: { x: number; y: number; width?: number; height?: number }) => ({ x: l.x + (l.width ?? 0) / 2, y: l.y + (l.height ?? 0) / 2 });
      const [before, after] = element.kind === 'image' ? [center(element.layout!), center(imported.layout!)] : [element.layout!, imported.layout!];
      expect(after.x).toBeCloseTo(before.x, 0);
      expect(after.y).toBeCloseTo(before.y, 0);
      if (element.kind === 'figure') expect(imported).toMatchObject({ shape: element.shape, name: element.name });
    }
    expect(diagram.relations.map(({ id, kind, source, target, label, arrowheads, dashed }) => ({ id, kind, source, target, label, arrowheads, dashed }))).toEqual(
      original.relations.map(({ id, kind, source, target, label, arrowheads, dashed }) => ({
        id, kind, source, target, label, arrowheads: arrowheads === 'end' ? undefined : arrowheads, dashed,
      })),
    );
  });

  it('el resultado se valida y se puede volver a disponer', async () => {
    const { diagram } = importExcalidraw(exportExcalidraw(await laidOut()));
    expect(validateDiagram(diagram).ok).toBe(true);
    const again = await layoutDiagram({ ...diagram, id: 'dg_goldengolden', revision: 1, createdAt: '', updatedAt: '' });
    expect(again.elements).toHaveLength(diagram.elements.length);
  });
});
