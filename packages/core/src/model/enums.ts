export const DIAGRAM_TYPES = ['class', 'c4-context', 'c4-container', 'c4-component', 'er', 'nosql'] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export const CLASS_ELEMENT_KINDS = ['class', 'interface', 'enum', 'package'] as const;
export type ClassElementKind = (typeof CLASS_ELEMENT_KINDS)[number];

export const C4_ELEMENT_KINDS = ['person', 'software-system', 'container', 'component', 'boundary'] as const;
export type C4ElementKind = (typeof C4_ELEMENT_KINDS)[number];

export const ER_ELEMENT_KINDS = ['entity', 'table', 'attribute', 'value-list', 'relationship', 'specialization'] as const;
export type ErElementKind = (typeof ER_ELEMENT_KINDS)[number];

export const NOSQL_ELEMENT_KINDS = ['collection'] as const;
export type NoSqlElementKind = (typeof NOSQL_ELEMENT_KINDS)[number];

/** Figuras generales: válidas en todos los tipos de diagrama. */
export const FIGURE_ELEMENT_KINDS = ['figure'] as const;
export const IMAGE_ELEMENT_KINDS = ['image'] as const;
export type FigureElementKind = (typeof FIGURE_ELEMENT_KINDS)[number];
export type ImageElementKind = (typeof IMAGE_ELEMENT_KINDS)[number];

/** Marcos genéricos para agrupar elementos en cualquier diagrama. */
export const FRAME_ELEMENT_KINDS = ['frame'] as const;
export type FrameElementKind = (typeof FRAME_ELEMENT_KINDS)[number];

/** Trazos libres: válidos en todos los tipos de diagrama. */
export const DRAWING_ELEMENT_KINDS = ['drawing'] as const;
export type DrawingElementKind = (typeof DRAWING_ELEMENT_KINDS)[number];

/** Bloques de texto con formato liviano y código resaltado: válidos en todos los tipos de diagrama. */
export const TEXT_ELEMENT_KINDS = ['text'] as const;
export type TextElementKind = (typeof TEXT_ELEMENT_KINDS)[number];

export const FIGURE_SHAPES = ['circle', 'square', 'rectangle', 'triangle', 'isosceles-triangle', 'equilateral-triangle', 'scalene-triangle', 'right-triangle', 'hexagon', 'cloud', 'diamond', 'parallelogram', 'oval', 'pentagon', 'heptagon', 'octagon', 'arrow', 'double-arrow', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down'] as const;
export type FigureShape = (typeof FIGURE_SHAPES)[number];

export type ElementKind = ClassElementKind | C4ElementKind | ErElementKind | NoSqlElementKind | FigureElementKind | DrawingElementKind | ImageElementKind | FrameElementKind | TextElementKind;

/** Elementos que agrupan a otros mediante `parentId`. */
export const GROUP_KINDS = ['package', 'boundary', 'frame'] as const satisfies readonly ElementKind[];

export const UML_RELATION_KINDS = [
  'association',
  'aggregation',
  'composition',
  'inheritance',
  'realization',
  'dependency',
] as const;
/** Conector libre: flecha o línea sin semántica UML/C4, válida en cualquier diagrama y entre familias. */
export const CONNECTOR_KIND = 'connector';
export const NOSQL_RELATION_KIND = 'nosql-rel';
export const RELATION_KINDS = [...UML_RELATION_KINDS, 'c4-rel', 'er-rel', 'er-attr', NOSQL_RELATION_KIND, CONNECTOR_KIND] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** Relaciones UML que admiten multiplicidades en sus extremos. */
export const MULTIPLICITY_RELATION_KINDS = ['association', 'aggregation', 'composition'] as const;

/** Puntas de un conector: ninguna, solo en el destino (por defecto) o en ambos extremos. */
export const ARROWHEADS = ['none', 'end', 'both'] as const;
export type Arrowheads = (typeof ARROWHEADS)[number];

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
  'RELATION_NOT_ALLOWED',
  'INHERITANCE_CYCLE',
  'INVALID_PARENT',
  'PARENT_CYCLE',
  'FIELD_NOT_ALLOWED',
  'INVALID_MEMBER',
  'FIELD_REQUIRED',
  'INVALID_NOSQL_FIELD',
  'LIMIT_EXCEEDED',
  'SCHEMA_VIOLATION',
  'DIAGRAM_NOT_FOUND',
  'PROJECT_NOT_FOUND',
  'NO_ACTIVE_DIAGRAM',
  'NOTHING_TO_UNDO',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Familia de elementos que une cada relación en sus dos extremos. Las relaciones de clases y C4
 * también unen figuras; el conector no aparece aquí: une cualquier par que no sea grupo.
 */
export const RELATION_ENDPOINT_KINDS: Partial<Record<RelationKind, readonly ElementKind[]>> = {
  association: [...CLASS_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
  aggregation: [...CLASS_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
  composition: [...CLASS_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
  inheritance: CLASS_ELEMENT_KINDS,
  realization: CLASS_ELEMENT_KINDS,
  dependency: [...CLASS_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
  'c4-rel': [...C4_ELEMENT_KINDS, ...FIGURE_ELEMENT_KINDS],
  'er-rel': ER_ELEMENT_KINDS,
  'er-attr': ER_ELEMENT_KINDS,
  [NOSQL_RELATION_KIND]: NOSQL_ELEMENT_KINDS,
};

export const DEFAULT_MAX_ELEMENTS = 500;
export const MAX_OPERATIONS_PER_BATCH = 200;

export function isGroupKind(kind: string): kind is (typeof GROUP_KINDS)[number] {
  return (GROUP_KINDS as readonly string[]).includes(kind);
}
