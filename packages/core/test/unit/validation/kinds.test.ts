import { describe, expect, it } from 'vitest';
import type { DiagramType } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { codes } from '../../support/fixtures.js';

const samples: Record<string, Record<string, unknown>> = {
  class: { kind: 'class', attributes: [], operations: [] },
  interface: { kind: 'interface', operations: [] },
  enum: { kind: 'enum', literals: ['A'] },
  package: { kind: 'package' },
  person: { kind: 'person' },
  'software-system': { kind: 'software-system' },
  container: { kind: 'container' },
  component: { kind: 'component' },
  boundary: { kind: 'boundary', boundaryType: 'container' },
  entity: { kind: 'entity' },
  collection: { kind: 'collection', fields: [] },
  figure: { kind: 'figure', shape: 'hexagon' },
  attribute: { kind: 'attribute' },
  'value-list': { kind: 'value-list', values: ['A'] },
};

// Las figuras generales se permiten en todos los tipos de diagrama.
const allowed: Record<DiagramType, string[]> = {
  class: ['class', 'interface', 'enum', 'package', 'figure'],
  'c4-context': ['person', 'software-system', 'boundary', 'figure'],
  'c4-container': ['person', 'software-system', 'container', 'boundary', 'figure'],
  'c4-component': ['person', 'software-system', 'container', 'component', 'boundary', 'figure'],
  er: ['entity', 'attribute', 'value-list', 'figure'],
  nosql: ['collection', 'figure'],
};

function single(type: DiagramType, kind: string) {
  const element: Record<string, unknown> = { id: 'x', name: 'X', ...samples[kind] };
  // un component en c4-component necesita un boundary container: eso lo prueba hierarchy.
  const elements =
    kind === 'component'
      ? [
          { id: 'b', name: 'B', kind: 'boundary', boundaryType: 'container' },
          { ...element, parentId: 'b' },
        ]
      : [element];
  return validateDiagram({ type, title: 'T', elements, relations: [] });
}

describe('KIND_NOT_ALLOWED', () => {
  for (const type of Object.keys(allowed) as DiagramType[]) {
    for (const kind of Object.keys(samples)) {
      const ok = allowed[type].includes(kind);
      it(`${kind} en ${type} ⇒ ${ok ? 'permitido' : 'KIND_NOT_ALLOWED'}`, () => {
        const res = single(type, kind);
        if (ok) expect(res.ok ? [] : codes(res.errors)).not.toContain('KIND_NOT_ALLOWED');
        else {
          expect(res.ok).toBe(false);
          if (!res.ok) {
            const err = res.errors.find((e) => e.code === 'KIND_NOT_ALLOWED');
            expect(err?.path).toMatch(/^\/elements\/\d+\/kind$/);
          }
        }
      });
    }
  }
});
