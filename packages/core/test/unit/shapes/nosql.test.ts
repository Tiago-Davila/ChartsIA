import { describe, expect, it } from 'vitest';
import { type Element } from '../../../src/model/index.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';
import { measureText } from '../../../src/shapes/text-metrics.js';

const pedido: Element = {
  id: 'Pedido',
  kind: 'collection',
  name: 'pedidos',
  fields: [
    { path: ['total'], type: 'number' },
    { path: ['cliente'], type: 'object' },
    { path: ['cliente', 'nombre'], type: 'string' },
    { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
    { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
  ],
};

describe('forma de colecciones NoSQL', () => {
  it('mide y dibuja subdocumentos y arrays de objetos en cajas anidadas', () => {
    const size = measureElement(pedido);
    const primitives = elementPrimitives(pedido, size);
    const boxes = primitives.filter((primitive) => primitive.type === 'rect');
    const labels = primitives.filter((primitive) => primitive.type === 'text').map((primitive) => primitive.text);

    expect(size.width).toBeGreaterThan(180);
    expect(size.height).toBeGreaterThan(140);
    expect(boxes.length).toBeGreaterThanOrEqual(4);
    expect(labels).toEqual(expect.arrayContaining([
      'pedidos',
      'total: number',
      'cliente: object',
      'direcciones: array<object>',
      'calle: string',
    ]));
  });

  it('incluye todos los campos aunque estén en un orden distinto al árbol', () => {
    const element: Element = {
      ...pedido,
      fields: [
        { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
        { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
        { path: ['cliente'], type: 'object' },
      ],
    };
    const labels = elementPrimitives(element, measureElement(element)).filter((primitive) => primitive.type === 'text').map((primitive) => primitive.text);
    expect(labels).toContain('calle: string');
  });

  it('mide títulos largos y filas con el tamaño de fuente máximo', () => {
    const element: Element = {
      ...pedido,
      name: 'coleccion_de_pedidos_con_un_nombre_deliberadamente_largo',
      style: { fontSize: 48 },
    };
    const size = measureElement(element);
    const primitives = elementPrimitives(element, size);
    const title = primitives.find((primitive) => primitive.type === 'text' && primitive.text === element.name);
    const firstField = primitives.find((primitive) => primitive.type === 'text' && primitive.text === 'total: number');
    const header = primitives.find((primitive) => primitive.type === 'rect' && primitive.y === 0 && primitive.height < size.height);

    expect(size.width).toBeGreaterThanOrEqual(measureText(element.name, { size: 48, bold: true }) + 24);
    expect(title?.type).toBe('text');
    expect(title?.type === 'text' && title.size).toBe(48);
    expect(header?.type === 'rect' && header.height).toBeGreaterThan(48);
    expect(firstField?.type === 'text' && firstField.size).toBeGreaterThan(40);
    expect(firstField?.type === 'text' && firstField.y).toBeGreaterThan(header?.type === 'rect' ? header.height : 0);
  });
});
