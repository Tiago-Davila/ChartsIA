import type { DiagramInput } from '../../src/model/index.js';

/** Diagrama de clases mínimo y válido usado como base por los tests. */
export function classDiagram(overrides: Partial<DiagramInput> = {}): DiagramInput {
  return {
    type: 'class',
    title: 'Biblioteca',
    elements: [
      {
        id: 'Libro',
        kind: 'class',
        name: 'Libro',
        attributes: [{ name: 'isbn', type: 'String', visibility: '-' }],
        operations: [{ name: 'prestar', parameters: [], visibility: '+' }],
      },
      { id: 'Autor', kind: 'class', name: 'Autor', attributes: [], operations: [] },
      { id: 'Prestable', kind: 'interface', name: 'Prestable', operations: [] },
      { id: 'Estado', kind: 'enum', name: 'Estado', literals: ['LIBRE', 'PRESTADO'] },
    ],
    relations: [
      { id: 'r1', kind: 'association', source: 'Libro', target: 'Autor', targetMultiplicity: '1..*' },
      { id: 'r2', kind: 'realization', source: 'Libro', target: 'Prestable' },
    ],
    ...overrides,
  } as DiagramInput;
}

/** Diagrama C4 de contenedores mínimo y válido. */
export function c4ContainerDiagram(overrides: Partial<DiagramInput> = {}): DiagramInput {
  return {
    type: 'c4-container',
    title: 'Tienda',
    elements: [
      { id: 'cliente', kind: 'person', name: 'Cliente' },
      { id: 'tienda', kind: 'boundary', name: 'Tienda online', boundaryType: 'system' },
      { id: 'web', kind: 'container', name: 'Web', technology: 'React', variant: 'web', parentId: 'tienda' },
      { id: 'db', kind: 'container', name: 'BD', technology: 'PostgreSQL', variant: 'database', parentId: 'tienda' },
      { id: 'pagos', kind: 'software-system', name: 'Pasarela', external: true },
    ],
    relations: [
      { id: 'u1', kind: 'c4-rel', source: 'cliente', target: 'web', label: 'Compra', technology: 'HTTPS' },
      { id: 'u2', kind: 'c4-rel', source: 'web', target: 'db', label: 'Lee y escribe' },
      { id: 'u3', kind: 'c4-rel', source: 'web', target: 'pagos', label: 'Cobra' },
    ],
    ...overrides,
  } as DiagramInput;
}

/** Diagrama ER mínimo y válido: una entidad débil y relaciones de los dos tipos. */
export function erDiagram(overrides: Partial<DiagramInput> = {}): DiagramInput {
  return {
    type: 'er',
    title: 'Tienda',
    elements: [
      { id: 'cliente', kind: 'entity', name: 'Cliente' },
      { id: 'pedido', kind: 'entity', name: 'Pedido' },
      { id: 'linea', kind: 'entity', name: 'Línea', weak: true },
    ],
    relations: [
      { id: 'r1', kind: 'er-rel', source: 'cliente', target: 'pedido', label: 'hace', sourceCardinality: 'one', targetCardinality: 'zero-many' },
      { id: 'r2', kind: 'er-rel', source: 'pedido', target: 'linea', identifying: true, sourceCardinality: 'one', targetCardinality: 'one-many' },
    ],
    ...overrides,
  } as DiagramInput;
}

export function codes(errors: { code: string }[]): string[] {
  return errors.map((e) => e.code);
}
