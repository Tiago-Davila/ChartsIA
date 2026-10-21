export const DIAGRAM_TYPES = ['class', 'c4-context', 'c4-container', 'c4-component', 'er'] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export const CLASS_ELEMENT_KINDS = ['class', 'interface', 'enum', 'package'] as const;
export type ClassElementKind = (typeof CLASS_ELEMENT_KINDS)[number];

export const C4_ELEMENT_KINDS = ['person', 'software-system', 'container', 'component', 'boundary'] as const;
export type C4ElementKind = (typeof C4_ELEMENT_KINDS)[number];

export const ER_ELEMENT_KINDS = ['entity', 'table'] as const;
export type ErElementKind = (typeof ER_ELEMENT_KINDS)[number];

/** Figuras generales (círculo, cuadrado, rectángulo, triángulo, hexágono y nube): válidas en todos los tipos de diagrama. */
export const FIGURE_ELEMENT_KINDS = ['figure'] as const;
export type FigureElementKind = (typeof FIGURE_ELEMENT_KINDS)[number];

export const FIGURE_SHAPES = ['circle', 'square', 'rectangle', 'triangle', 'hexagon', 'cloud'] as const;
export type FigureShape = (typeof FIGURE_SHAPES)[number];

export type ElementKind = ClassElementKind | C4ElementKind | ErElementKind | FigureElementKind;

/** Elementos que agrupan a otros mediante `parentId`. */
export const GROUP_KINDS = ['package', 'boundary'] as const satisfies readonly ElementKind[];

export const UML_RELATION_KINDS = [
  'association',
  'aggregation',
  'composition',
  'inheritance',
  'realization',
  'dependency',
] as const;
export const RELATION_KINDS = [...UML_RELATION_KINDS, 'c4-rel', 'er-rel'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Relaciones UML que admiten multiplicidades en sus extremos. */
export const MULTIPLICITY_RELATION_KINDS = ['association', 'aggregation', 'composition'] as const;

/** Cardinalidad de un extremo de una relación ER (pata de gallo). */
export const CARDINALITIES = ['one', 'zero-one', 'one-many', 'zero-many'] as const;
export type Cardinality = (typeof CARDINALITIES)[number];

/** Lado de una caja por el que sale o entra una relación. */
export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];

export const VISIBILITIES = ['+', '-', '#', '~'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const CONTAINER_VARIANTS = ['default', 'database', 'queue', 'web'] as const;
export type ContainerVariant = (typeof CONTAINER_VARIANTS)[number];

export const BOUNDARY_TYPES = ['enterprise', 'system', 'container'] as const;
export type BoundaryType = (typeof BOUNDARY_TYPES)[number];

export const NAVIGABILITIES = ['none', 'source-to-target', 'both'] as const;
export type Navigability = (typeof NAVIGABILITIES)[number];

export const ERROR_CODES = [
  'DUPLICATE_ID',
  'UNKNOWN_REFERENCE',
  'KIND_NOT_ALLOWED',
  'RELATION_NOT_ALLOWED',
  'INHERITANCE_CYCLE',
  'INVALID_PARENT',
  'PARENT_CYCLE',
  'FIELD_NOT_ALLOWED',
  'INVALID_MEMBER',
  'FIELD_REQUIRED',
  'LIMIT_EXCEEDED',
  'SCHEMA_VIOLATION',
  'DIAGRAM_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'NO_ACTIVE_DIAGRAM',
  'NOTHING_TO_UNDO',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Las figuras generales se permiten en todos los tipos de diagrama (decisión del issue #194). */
export const ALLOWED_KINDS_BY_DIAGRAM: Readonly<Record<DiagramType, readonly ElementKind[]>> = {
  class: [...CLASS_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
  'c4-context': ['person', 'software-system', 'boundary', ...FIGURE_ELEMENT_KINDS],
  'c4-container': ['person', 'software-system', 'container', 'boundary', ...FIGURE_ELEMENT_KINDS],
  'c4-component': ['person', 'software-system', 'container', 'component', 'boundary', ...FIGURE_ELEMENT_KINDS],
  er: [...ER_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
};

export const ALLOWED_RELATIONS_BY_DIAGRAM: Readonly<Record<DiagramType, readonly RelationKind[]>> = {
  class: UML_RELATION_KINDS,
  'c4-context': ['c4-rel'],
  'c4-container': ['c4-rel'],
  'c4-component': ['c4-rel'],
  er: ['er-rel'],
};

export const DEFAULT_MAX_ELEMENTS = 500;
export const MAX_OPERATIONS_PER_BATCH = 200;

export function isGroupKind(kind: string): kind is (typeof GROUP_KINDS)[number] {
  return (GROUP_KINDS as readonly string[]).includes(kind);
}

export function isC4Diagram(type: DiagramType): boolean {
  return type.startsWith('c4-');
}
