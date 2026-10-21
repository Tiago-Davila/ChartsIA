import { describe, expect, it } from 'vitest';
import { edgePrimitives } from '../../../src/render/edges.js';
import { relationStyle } from '../../../src/shapes/uml/markers.js';

const route = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
const connector = (extra: Record<string, unknown>) => ({ id: 'r', kind: 'connector', source: 'A', target: 'B', route, ...extra }) as never;

describe('relación connector', () => {
  it('por defecto lleva punta abierta en el destino y línea continua', () => {
    expect(relationStyle({ kind: 'connector' })).toMatchObject({ end: 'arrow-open' });
    expect(relationStyle({ kind: 'connector' }).start).toBeUndefined();
    expect(relationStyle({ kind: 'connector' }).dash).toBeUndefined();
  });

  it('none no lleva puntas y both las lleva en los dos extremos', () => {
    const none = relationStyle({ kind: 'connector', arrowheads: 'none' });
    expect(none.start).toBeUndefined();
    expect(none.end).toBeUndefined();
    expect(relationStyle({ kind: 'connector', arrowheads: 'both' })).toMatchObject({ start: 'arrow-open', end: 'arrow-open' });
  });

  it('dashed dibuja la línea discontinua', () => {
    expect(relationStyle({ kind: 'connector', dashed: true }).dash).toBeDefined();
    const line = edgePrimitives(connector({ dashed: true })).find((p) => p.type === 'path');
    expect(line).toMatchObject({ dash: [6, 4] });
  });

  it('dibuja una línea sin puntas y una etiqueta', () => {
    const prims = edgePrimitives(connector({ arrowheads: 'none', label: 'une' }));
    expect(prims.filter((p) => p.type === 'path')).toHaveLength(1);
    expect(prims.some((p) => p.type === 'text' && p.text === 'une')).toBe(true);
  });

  it('con puntas en ambos extremos dibuja tres trazos', () => {
    expect(edgePrimitives(connector({ arrowheads: 'both' })).filter((p) => p.type === 'path')).toHaveLength(3);
  });
});
