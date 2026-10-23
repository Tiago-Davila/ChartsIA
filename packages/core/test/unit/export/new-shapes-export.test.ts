import { describe, expect, it } from 'vitest';
import { exportDiagram } from '../../../src/export/index.js';
import { cloudPoints } from '../../../src/shapes/index.js';
import { loadFixture } from '../../support/golden-fixtures.js';
import { findAll, parseXml } from '../../support/xml.js';

interface El {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[][];
  roundness: { type: number } | null;
  groupIds: string[];
  boundElements: unknown[] | null;
  startBinding: unknown;
  endBinding: unknown;
  startArrowhead: string | null;
  endArrowhead: string | null;
  strokeStyle: string;
  text: string;
  originalText: string;
}

async function excalidraw(name: string): Promise<El[]> {
  return JSON.parse(exportDiagram(await loadFixture(name), 'excalidraw').content).elements;
}

async function drawioCells(name: string): Promise<Map<string, Record<string, string>>> {
  const file = parseXml(exportDiagram(await loadFixture(name), 'drawio').content);
  const cells = findAll(file, 'root')[0]!.children;
  return new Map(cells.map((c) => [c.attrs.id!, c.name === 'object' ? { ...c.attrs, ...c.children[0]!.attrs } : c.attrs]));
}

describe('figuras en Excalidraw', () => {
  it('la nube es una línea cerrada con curva suave, no una elipse', async () => {
    const cloud = (await excalidraw('figures')).find((e) => e.id === 'nube')!;
    expect(cloud.type).toBe('line');
    expect(cloud.roundness).toEqual({ type: 2 });
    expect(cloud.points[cloud.points.length - 1]).toEqual(cloud.points[0]);
    expect(cloud.points.length).toBeGreaterThan(20);
  });

  it('el texto de triángulo, hexágono y nube va en el grupo de su forma y no se vinculan flechas a esas líneas', async () => {
    const elements = await excalidraw('figures');
    for (const id of ['nube', 'hexagono', 'triangulo']) {
      const shape = elements.find((e) => e.id === id)!;
      const label = elements.find((e) => e.id === `${id}-label`)!;
      expect(shape.groupIds).toEqual([`${id}-group`]);
      expect(label.groupIds).toEqual(shape.groupIds);
      expect(shape.boundElements).toBeNull();
    }
    const arrow = elements.find((e) => e.id === 'r1')!;
    expect(arrow.endBinding).toBeNull();
    expect(arrow.startBinding).not.toBeNull();
  });

  it('el texto largo de un rectángulo se parte en líneas y queda dentro de la forma', async () => {
    const elements = await excalidraw('figures');
    const label = elements.find((e) => e.id === 'rectangulo-label')!;
    const box = elements.find((e) => e.id === 'rectangulo')!;
    expect(label.text.split('\n').length).toBeGreaterThan(1);
    expect(label.originalText).not.toContain('\n');
    expect(label.width).toBeLessThanOrEqual(box.width);
    expect(label.height).toBeLessThanOrEqual(box.height);
  });

  it('la clave de un atributo se subraya con una línea del ancho del texto', async () => {
    const elements = await excalidraw('shop-er-chen');
    const label = elements.find((e) => e.id === 'dni-label')!;
    const underline = elements.find((e) => e.id === 'dni-underline')!;
    expect(underline.type).toBe('line');
    expect(underline.x).toBeCloseTo(label.x, 1);
    expect(underline.width).toBeCloseTo(label.width, 1);
    expect(underline.y).toBeGreaterThan(label.y + label.height / 2);
    expect(underline.groupIds).toEqual(elements.find((e) => e.id === 'dni')!.groupIds);
  });

  it('la PK de una tabla se subraya y las demás columnas no', async () => {
    const elements = await excalidraw('shop-er-tables');
    const underlined = elements.filter((e) => e.id.endsWith('-underline')).map((e) => e.id);
    expect(underlined.sort()).toEqual(['cliente-column:0-underline', 'linea-column:0-underline', 'linea-column:1-underline', 'pedido-column:0-underline']);
  });

  it('la etiqueta de una flecha mide lo que su texto y no tapa el trazo', async () => {
    const elements = await excalidraw('connectors');
    const label = elements.find((e) => e.id === 'r2-label')!;
    expect(label.width).toBeLessThan(120);
    expect(label.width).toBeGreaterThan(40);
  });

  it('el óvalo discontinuo de un atributo derivado y el doble óvalo del multivaluado se exportan', async () => {
    const elements = await excalidraw('shop-er-chen');
    expect(elements.find((e) => e.id === 'edad')!.strokeStyle).toBe('dashed');
    const inner = elements.find((e) => e.id === 'telefonos-inner')!;
    expect(inner.type).toBe('ellipse');
    expect(inner.width).toBeLessThan(elements.find((e) => e.id === 'telefonos')!.width);
  });
});

describe('conectores en Excalidraw', () => {
  it('puntas y trazo discontinuo según arrowheads y dashed', async () => {
    const elements = await excalidraw('connectors');
    const get = (id: string) => elements.find((e) => e.id === id)!;
    expect([get('r2').startArrowhead, get('r2').endArrowhead, get('r2').strokeStyle]).toEqual([null, 'arrow', 'solid']);
    expect([get('r3').startArrowhead, get('r3').endArrowhead, get('r3').strokeStyle]).toEqual(['arrow', 'arrow', 'dashed']);
    expect([get('r4').startArrowhead, get('r4').endArrowhead]).toEqual([null, null]);
  });

  it('los tramos alineados se unen para que Excalidraw ponga la etiqueta en el centro de la flecha', async () => {
    const points: number[][] = (await excalidraw('connectors')).find((e) => e.id === 'r5')!.points;
    expect(points).toHaveLength(2);
  });
});

describe('figuras y conectores en draw.io', () => {
  it('el triángulo baja el texto a su mitad inferior y deshace el giro de direction=north en los puertos', async () => {
    const cells = await drawioCells('figures');
    expect(cells.get('triangulo')!.style).toContain('spacingTop=52;');
    // La arista llega a la punta (0,0.5 de la forma sin girar es 1,0.5 una vez girada).
    expect(cells.get('r3')!.style).toContain('entryX=1;entryY=0.5;');
  });

  it('puntas y trazo de los conectores', async () => {
    const cells = await drawioCells('connectors');
    expect(cells.get('r2')!.style).toContain('endArrow=open;');
    expect(cells.get('r2')!.style).not.toContain('dashed=1');
    expect(cells.get('r3')!.style).toMatch(/startArrow=open;.*endArrow=open;.*dashed=1;/);
    expect(cells.get('r4')!.style).toContain('endArrow=none;');
  });

  it('atributo clave subrayado, multivaluado con doble óvalo y derivado discontinuo', async () => {
    const cells = await drawioCells('shop-er-chen');
    expect(cells.get('dni')!.style).toContain('fontStyle=4;');
    expect(cells.get('telefonos')!.style).toContain('shape=doubleEllipse;');
    expect(cells.get('edad')!.style).toContain('dashed=1;');
  });

  it('la PK de una tabla va en negrita y subrayada', async () => {
    const cells = await drawioCells('shop-er-tables');
    expect(cells.get('cliente:column:0')!.style).toContain('fontStyle=5;');
    expect(cells.get('cliente:column:1')!.style).not.toContain('fontStyle');
  });
});

describe('cloudPoints', () => {
  it('muestrea la curva de la nube dentro de su caja', () => {
    const points = cloudPoints({ width: 140, height: 90 });
    expect(points).toHaveLength(24);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(140);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(90);
    }
  });
});
