import { ALLOWED_KINDS_BY_DIAGRAM, type Diagram, type DiagramType, type Element, type ElementKind, type FigureShape } from '@chartsia/core/model';
import { freeId } from './edge-edits';

/** Tipo MIME con el que la barra de figuras identifica la figura arrastrada. */
export const FIGURE_DRAG_TYPE = 'application/x-chartsia-figure';

export interface PaletteItem {
  key: string;
  label: string;
  kind: ElementKind;
  /** Base del id por defecto: sin tildes ni espacios. */
  idBase: string;
  /** Elemento mínimo válido de su tipo, sin posición. */
  build(id: string, name: string): Element;
}

// Figura general con la forma indicada.
function figure(shape: FigureShape, label: string, idBase: string): PaletteItem {
  return { key: `figure-${shape}`, label, kind: 'figure', idBase, build: (id, name) => ({ id, name, kind: 'figure', shape }) };
}

/** Todas las figuras que la barra sabe crear; las imágenes y los trazos tienen sus propios botones. */
export const PALETTE_ITEMS: readonly PaletteItem[] = [
  { key: 'class', label: 'Clase', kind: 'class', idBase: 'Clase', build: (id, name) => ({ id, name, kind: 'class', attributes: [], operations: [] }) },
  { key: 'interface', label: 'Interfaz', kind: 'interface', idBase: 'Interfaz', build: (id, name) => ({ id, name, kind: 'interface', operations: [] }) },
  { key: 'enum', label: 'Enumeración', kind: 'enum', idBase: 'Enumeracion', build: (id, name) => ({ id, name, kind: 'enum', literals: ['VALOR'] }) },
  { key: 'package', label: 'Paquete', kind: 'package', idBase: 'Paquete', build: (id, name) => ({ id, name, kind: 'package' }) },
  { key: 'person', label: 'Persona', kind: 'person', idBase: 'Persona', build: (id, name) => ({ id, name, kind: 'person' }) },
  { key: 'software-system', label: 'Sistema', kind: 'software-system', idBase: 'Sistema', build: (id, name) => ({ id, name, kind: 'software-system' }) },
  { key: 'container', label: 'Contenedor', kind: 'container', idBase: 'Contenedor', build: (id, name) => ({ id, name, kind: 'container' }) },
  { key: 'component', label: 'Componente', kind: 'component', idBase: 'Componente', build: (id, name) => ({ id, name, kind: 'component' }) },
  { key: 'boundary', label: 'Límite', kind: 'boundary', idBase: 'Limite', build: (id, name) => ({ id, name, kind: 'boundary', boundaryType: 'container' }) },
  { key: 'entity', label: 'Entidad', kind: 'entity', idBase: 'Entidad', build: (id, name) => ({ id, name, kind: 'entity' }) },
  { key: 'table', label: 'Tabla', kind: 'table', idBase: 'Tabla', build: (id, name) => ({ id, name, kind: 'table', columns: [{ name: 'id', type: 'int', pk: true }] }) },
  { key: 'attribute', label: 'Atributo', kind: 'attribute', idBase: 'Atributo', build: (id, name) => ({ id, name, kind: 'attribute' }) },
  { key: 'value-list', label: 'Lista de valores', kind: 'value-list', idBase: 'Lista', build: (id, name) => ({ id, name, kind: 'value-list', values: ['valor'] }) },
  { key: 'collection', label: 'Colección', kind: 'collection', idBase: 'Coleccion', build: (id, name) => ({ id, name, kind: 'collection', fields: [] }) },
  figure('square', 'Cuadrado', 'Cuadrado'),
  figure('rectangle', 'Rectángulo', 'Rectangulo'),
  figure('circle', 'Círculo', 'Circulo'),
  figure('triangle', 'Triángulo', 'Triangulo'),
  figure('hexagon', 'Hexágono', 'Hexagono'),
  figure('cloud', 'Nube', 'Nube'),
  { key: 'frame', label: 'Marco', kind: 'frame', idBase: 'Marco', build: (id, name) => ({ id, name, kind: 'frame', layout: { x: 0, y: 0, width: 320, height: 200 } }) },
];

/** Figuras que admite el tipo de diagrama, según las reglas del núcleo. */
export function paletteFor(type: DiagramType): PaletteItem[] {
  const allowed = ALLOWED_KINDS_BY_DIAGRAM[type];
  return PALETTE_ITEMS.filter((item) => allowed.includes(item.kind));
}

// Elemento con id y nombre libres (`Clase`, `Clase2`…), fijado en la posición dada.
function placed(diagram: Pick<Diagram, 'elements' | 'relations'>, item: PaletteItem, point: { x: number; y: number }): Element {
  const id = freeId(diagram, item.idBase);
  const element = item.build(id, item.label + id.slice(item.idBase.length));
  return { ...element, layout: { ...element.layout, x: Math.round(point.x), y: Math.round(point.y) } };
}

/**
 * Elementos que crea soltar una figura en la posición dada. En C4 componentes, un componente
 * exige estar dentro de un límite de contenedor: usa el primero que exista o crea uno con él.
 */
export function newPaletteElements(diagram: Pick<Diagram, 'type' | 'elements' | 'relations'>, item: PaletteItem, point: { x: number; y: number }): Element[] {
  const element = placed(diagram, item, point);
  if (item.kind !== 'component' || diagram.type !== 'c4-component') return [element];
  const boundary = diagram.elements.find((e) => e.kind === 'boundary' && e.boundaryType === 'container');
  if (boundary) return [{ ...element, parentId: boundary.id }];
  const created = placed(diagram, PALETTE_ITEMS.find((candidate) => candidate.key === 'boundary')!, point);
  const child = placed({ elements: [...diagram.elements, created], relations: diagram.relations }, item, { x: point.x + 20, y: point.y + 40 });
  return [created, { ...child, parentId: created.id }];
}
