import { describe, expect, it } from 'vitest';
import { FLOW_VARIANTS, type Element, type Relation } from '../../../src/model/index.js';
import { edgePrimitives } from '../../../src/render/edges.js';
import { elementPrimitives, FLOW_PALETTE, measureElement } from '../../../src/shapes/index.js';
import { relationStyle } from '../../../src/shapes/uml/markers.js';

const node = (variant: (typeof FLOW_VARIANTS)[number], extra: Partial<Element> = {}): Element => ({ id: 'N', kind: 'flow-node', variant, name: 'OrdersController', ...extra }) as Element;

describe('forma de nodos de flujo', () => {
  it.each(FLOW_VARIANTS)('dibuja la variante %s con su ícono, color, título y subtítulo', (variant) => {
    const element = node(variant, { subtitle: 'src/orders/orders.controller.ts' } as Partial<Element>);
    const size = measureElement(element);
    const primitives = elementPrimitives(element, size);
    expect(primitives.some((p) => p.type === 'rect' && p.fill === FLOW_PALETTE[variant].tint)).toBe(true);
    expect(primitives.some((p) => (p.type === 'path' || p.type === 'ellipse') && p.stroke === FLOW_PALETTE[variant].accent)).toBe(true);
    expect(primitives.filter((p) => p.type === 'text').map((p) => p.type === 'text' && p.text)).toEqual(['OrdersController', 'src/orders/orders.controller.ts']);
  });

  it('cada variante tiene un ícono distinto', () => {
    const icons = FLOW_VARIANTS.map((variant) => JSON.stringify(elementPrimitives(node(variant), measureElement(node(variant))).filter((p) => p.type === 'path' || p.type === 'ellipse')));
    expect(new Set(icons).size).toBe(FLOW_VARIANTS.length);
  });

  it('crece con el texto largo, parte las líneas y mantiene el texto dentro de la tarjeta', () => {
    const short = measureElement(node('file'));
    const long = node('file', { name: 'un nombre de componente muy largo que no cabe en una sola línea de la tarjeta', subtitle: 'src/' + 'carpeta/'.repeat(20) + 'archivo.ts' } as Partial<Element>);
    const size = measureElement(long);
    expect(size.width).toBeGreaterThan(short.width);
    expect(size.width).toBeLessThanOrEqual(360);
    expect(size.height).toBeGreaterThan(short.height);
    for (const p of elementPrimitives(long, size)) if (p.type === 'text') expect(p.y).toBeLessThan(size.height);
  });

  it('el estilo del usuario cambia relleno, borde y color del texto', () => {
    const element = node('file', { style: { fillColor: '#ffeeee', borderColor: '#aa0000', fontColor: '#0000aa' } });
    const [card, , ...rest] = elementPrimitives(element, measureElement(element));
    expect(card).toMatchObject({ fill: '#ffeeee', stroke: '#aa0000' });
    expect(rest.find((p) => p.type === 'text')).toMatchObject({ color: '#0000aa' });
  });

  it('el nodo externo tiene el borde discontinuo', () => {
    const [card] = elementPrimitives(node('external'), measureElement(node('external')));
    expect(card).toMatchObject({ dash: [6, 4] });
  });
});

describe('trazo de las conexiones de flujo', () => {
  const rel = (flowType?: Relation['flowType']): Relation => ({ id: 'r', kind: 'flow-edge', source: 'A', target: 'B', ...(flowType ? { flowType } : {}) });

  it('cada tipo tiene su trazo y llama es el de por defecto', () => {
    expect(relationStyle(rel())).toEqual(relationStyle(rel('call')));
    expect(relationStyle(rel('import'))).toMatchObject({ dash: [2, 4], end: 'arrow-open' });
    expect(relationStyle(rel('event'))).toMatchObject({ dash: [8, 4], end: 'arrow-open' });
    const strokes = (['call', 'import', 'read', 'write', 'event', 'data'] as const).map((type) => JSON.stringify(relationStyle(rel(type))));
    expect(new Set(strokes).size).toBe(6);
  });

  it('read lleva la flecha hacia el origen y write hacia el destino', () => {
    expect(relationStyle(rel('read'))).toMatchObject({ start: 'arrow-open' });
    expect(relationStyle(rel('read')).end).toBeUndefined();
    expect(relationStyle(rel('write'))).toMatchObject({ end: 'arrow-filled' });
    expect(relationStyle(rel('write')).start).toBeUndefined();
  });

  it('dibuja la línea y la etiqueta, y el estilo del usuario cambia el color', () => {
    const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const primitives = edgePrimitives({ ...rel('call'), label: 'create()', route, style: { borderColor: '#ff0000' } });
    expect(primitives[0]).toMatchObject({ type: 'path', stroke: '#ff0000' });
    expect(primitives.some((p) => p.type === 'text' && p.text === 'create()')).toBe(true);
  });
});
