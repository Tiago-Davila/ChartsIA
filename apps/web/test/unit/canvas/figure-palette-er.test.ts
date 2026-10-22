import { describe, expect, it } from 'vitest';
import { type Diagram, ElementSchema } from '@chartsia/core/model';
import { newPaletteEdit, paletteFor } from '../../../src/canvas/figure-palette';
import { kindChanges, reverseChanges } from '../../../src/canvas/edge-edits';

const vacio: Pick<Diagram, 'type' | 'elements' | 'relations'> = { type: 'er', elements: [], relations: [] };
const item = (key: string) => paletteFor('er').find((candidate) => candidate.key === key)!;

describe('barra de figuras ER', () => {
  it('ofrece cada figura nueva con su nombre', () => {
    const labels = paletteFor('er').map((candidate) => candidate.label);
    expect(labels).toEqual(expect.arrayContaining([
      'Entidad débil',
      'Entidad asociativa',
      'Relación',
      'Relación identificante',
      'Atributo clave',
      'Clave parcial',
      'Atributo multivaluado',
      'Atributo derivado',
      'Atributo compuesto',
      'Especialización disjunta',
      'Especialización solapada',
    ]));
  });

  it('cada figura nueva crea un elemento válido con su opción ya puesta', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['entity-weak', { weak: true }],
      ['entity-associative', { associative: true }],
      ['relationship-identifying', { identifying: true }],
      ['attribute-key', { key: true }],
      ['attribute-partial-key', { partialKey: true }],
      ['attribute-multivalued', { multivalued: true }],
      ['attribute-derived', { derived: true }],
      ['specialization-overlapping', { overlapping: true }],
    ];
    for (const [key, option] of cases) {
      const [element] = newPaletteEdit(vacio, item(key), { x: 0, y: 0 }).elements;
      expect(element).toMatchObject(option);
      expect(ElementSchema.safeParse(element).success).toBe(true);
    }
  });

  it('un atributo compuesto trae dos sub-atributos unidos a él con er-attr', () => {
    const { elements, relations } = newPaletteEdit(vacio, item('attribute-composite'), { x: 100, y: 100 });
    const [owner, first, second] = elements;
    expect(elements).toHaveLength(3);
    expect(relations).toEqual([
      { id: 'r1', kind: 'er-attr', source: owner!.id, target: first!.id },
      { id: 'r2', kind: 'er-attr', source: owner!.id, target: second!.id },
    ]);
  });

  it('las figuras simples no crean relaciones', () => {
    expect(newPaletteEdit(vacio, item('relationship'), { x: 0, y: 0 }).relations).toEqual([]);
  });
});

describe('participación total en las flechas', () => {
  const rel = { id: 'r', kind: 'connector' as const, source: 'A', target: 'B', sourceTotal: true, targetTotal: true };

  it('invertir una flecha intercambia los lados de la participación total', () => {
    expect(reverseChanges({ id: 'r', kind: 'connector', source: 'A', target: 'B', sourceTotal: true })).toMatchObject({ sourceTotal: null, targetTotal: true });
  });

  it('pasar a un tipo que no admite participación total la quita', () => {
    expect(kindChanges({ ...rel, kind: 'er-rel', sourceCardinality: 'one', targetCardinality: 'one' }, 'association')).toMatchObject({
      sourceTotal: null,
      targetTotal: null,
    });
  });
});
