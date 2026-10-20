import { type Diagram } from '@chartsia/core/model';

let counter = 0;

/** Diagrama persistible mínimo para tests de infraestructura. */
export function storedDiagram(overrides: Partial<Diagram> = {}): Diagram {
  counter++;
  const suffix = String.fromCharCode(97 + (counter % 26)).repeat(12);
  return {
    id: `dg_${suffix}`,
    type: 'class',
    title: `Diagrama ${counter}`,
    elements: [
      {
        id: 'A',
        kind: 'class',
        name: 'A',
        attributes: [],
        operations: [],
        layout: { x: 0, y: 0, width: 120, height: 60, pinned: false },
      },
    ],
    relations: [],
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
}
