import { describe, expect, it } from 'vitest';
import { type DiagramInput } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';

function er(elements: unknown[], relations: unknown[] = []) {
  return validateDiagram({
    type: 'er',
    title: 'Figuras',
    elements: [{ id: 'cliente', kind: 'entity', name: 'Cliente' }, { id: 'pedido', kind: 'entity', name: 'Pedido' }, ...elements],
    relations,
  } as DiagramInput);
}

const paths = (res: ReturnType<typeof validateDiagram>) => (res.ok ? [] : res.errors.map((e) => e.path));

describe('reglas de las figuras ER', () => {
  it('la clave parcial no puede ser también clave, multivaluada ni derivada', () => {
    const res = er([{ id: 'dni', kind: 'attribute', name: 'DNI', partialKey: true, key: true, multivalued: true, derived: true }]);
    expect(paths(res)).toContain('/elements/2/key');
  });

  it('una clave parcial sola es válida', () => {
    expect(er([{ id: 'dep', kind: 'attribute', name: 'Nombre', partialKey: true }]).ok).toBe(true);
  });

  it('la participación total solo aplica a er-rel y connector', () => {
    const res = er([{ id: 'dni', kind: 'attribute', name: 'DNI' }], [{ id: 'x', kind: 'er-attr', source: 'cliente', target: 'dni', sourceTotal: true }]);
    expect(paths(res)).toEqual(['/relations/0/sourceTotal']);
  });

  it('la participación total es válida en er-rel y en connector', () => {
    const res = er([{ id: 'rel', kind: 'relationship', name: 'Hace' }], [
      { id: 'r1', kind: 'er-rel', source: 'cliente', target: 'pedido', sourceCardinality: 'one', targetCardinality: 'zero-many', sourceTotal: true, targetTotal: true },
      { id: 'c1', kind: 'connector', source: 'cliente', target: 'rel', targetTotal: true },
    ]);
    expect(res.ok).toBe(true);
  });

  it('un rombo puede conectarse con conectores sin tipo de relación ER', () => {
    const res = er([{ id: 'hace', kind: 'relationship', name: 'Hace', identifying: true }], [
      { id: 'c1', kind: 'connector', source: 'cliente', target: 'hace', label: '1' },
      { id: 'c2', kind: 'connector', source: 'hace', target: 'pedido', label: 'N', sourceTotal: true },
    ]);
    expect(res.ok).toBe(true);
  });

  it('el rombo no sirve de extremo de una er-rel', () => {
    const res = er([{ id: 'hace', kind: 'relationship', name: 'Hace' }], [
      { id: 'r1', kind: 'er-rel', source: 'cliente', target: 'hace', sourceCardinality: 'one', targetCardinality: 'one' },
    ]);
    expect(res.ok).toBe(false);
  });
});
