import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPES, type DiagramType } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { pngDataUrl } from '../../support/images.js';

const samples: Record<string, Record<string, unknown>> = {
  class: { kind: 'class', attributes: [], operations: [] },
  interface: { kind: 'interface', operations: [] },
  enum: { kind: 'enum', literals: ['A'] },
  package: { kind: 'package' },
  frame: { kind: 'frame' },
  person: { kind: 'person' },
  'software-system': { kind: 'software-system' },
  container: { kind: 'container' },
  component: { kind: 'component' },
  boundary: { kind: 'boundary', boundaryType: 'container' },
  entity: { kind: 'entity' },
  table: { kind: 'table', columns: [{ name: 'id', type: 'INT', pk: true }] },
  relationship: { kind: 'relationship' },
  specialization: { kind: 'specialization' },
  collection: { kind: 'collection', fields: [] },
  figure: { kind: 'figure', shape: 'hexagon' },
  drawing: { kind: 'drawing', points: [{ x: 0, y: 0 }, { x: 12, y: 8 }], strokeColor: '#1f2933', strokeWidth: 2 },
  image: { kind: 'image', src: pngDataUrl() },
  text: { kind: 'text', name: '# Título\n\n**Hola** *mundo*' },
  attribute: { kind: 'attribute' },
  'value-list': { kind: 'value-list', values: ['A'] },
};

function single(type: DiagramType, kind: string) {
  const element: Record<string, unknown> = { id: 'x', name: 'X', ...samples[kind] };
  // un component necesita un boundary container: eso lo prueba hierarchy.
  const elements =
    kind === 'component'
      ? [
          { id: 'b', name: 'B', kind: 'boundary', boundaryType: 'container' },
          { ...element, parentId: 'b' },
        ]
      : [element];
  return validateDiagram({ type, title: 'T', elements, relations: [] });
}

describe('kinds válidos en cualquier tipo de diagrama', () => {
  for (const type of DIAGRAM_TYPES) {
    for (const kind of Object.keys(samples)) {
      it(`${kind} en ${type} es válido`, () => {
        expect(single(type, kind).ok).toBe(true);
      });
    }
  }

  it('un diagrama mixto admite clases, C4, ER, NoSQL y figuras a la vez', () => {
    const res = validateDiagram({
      type: 'class',
      title: 'Mixto',
      elements: [
        { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] },
        { id: 'P', kind: 'person', name: 'P' },
        { id: 'E', kind: 'entity', name: 'E' },
        { id: 'C', kind: 'collection', name: 'C', fields: [] },
        { id: 'F', kind: 'figure', name: 'F', shape: 'circle' },
      ],
      relations: [],
    });
    expect(res.ok).toBe(true);
  });
});
