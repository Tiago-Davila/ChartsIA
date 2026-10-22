import { ALLOWED_KINDS_BY_DIAGRAM, type Diagram, type DiagramType, type Element, type ElementKind, type FigureShape, type Point, type Relation } from '@chartsia/core/model';
import { measureElement } from '@chartsia/core/shapes';
import { freeId, relationId } from './edge-edits';

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
  { key: 'entity-weak', label: 'Entidad débil', kind: 'entity', idBase: 'EntidadDebil', build: (id, name) => ({ id, name, kind: 'entity', weak: true }) },
  { key: 'entity-associative', label: 'Entidad asociativa', kind: 'entity', idBase: 'EntidadAsociativa', build: (id, name) => ({ id, name, kind: 'entity', associative: true }) },
  { key: 'relationship', label: 'Relación', kind: 'relationship', idBase: 'Relacion', build: (id, name) => ({ id, name, kind: 'relationship' }) },
  { key: 'relationship-identifying', label: 'Relación identificante', kind: 'relationship', idBase: 'RelacionIdentificante', build: (id, name) => ({ id, name, kind: 'relationship', identifying: true }) },
  { key: 'attribute-key', label: 'Atributo clave', kind: 'attribute', idBase: 'AtributoClave', build: (id, name) => ({ id, name, kind: 'attribute', key: true }) },
  { key: 'attribute-partial-key', label: 'Clave parcial', kind: 'attribute', idBase: 'ClaveParcial', build: (id, name) => ({ id, name, kind: 'attribute', partialKey: true }) },
  { key: 'attribute-multivalued', label: 'Atributo multivaluado', kind: 'attribute', idBase: 'AtributoMultivaluado', build: (id, name) => ({ id, name, kind: 'attribute', multivalued: true }) },
  { key: 'attribute-derived', label: 'Atributo derivado', kind: 'attribute', idBase: 'AtributoDerivado', build: (id, name) => ({ id, name, kind: 'attribute', derived: true }) },
  { key: 'attribute-composite', label: 'Atributo compuesto', kind: 'attribute', idBase: 'AtributoCompuesto', build: (id, name) => ({ id, name, kind: 'attribute' }) },
  { key: 'specialization', label: 'Especialización disjunta', kind: 'specialization', idBase: 'EspecializacionDisjunta', build: (id, name) => ({ id, name, kind: 'specialization' }) },
  { key: 'specialization-overlapping', label: 'Especialización solapada', kind: 'specialization', idBase: 'EspecializacionSolapada', build: (id, name) => ({ id, name, kind: 'specialization', overlapping: true }) },
  { key: 'collection', label: 'Colección', kind: 'collection', idBase: 'Coleccion', build: (id, name) => ({ id, name, kind: 'collection', fields: [] }) },
  figure('square', 'Cuadrado', 'Cuadrado'),
  figure('rectangle', 'Rectángulo', 'Rectangulo'),
  figure('circle', 'Círculo', 'Circulo'),
  figure('equilateral-triangle', 'Triángulo equilátero', 'TrianguloEquilatero'),
  figure('isosceles-triangle', 'Triángulo isósceles', 'TrianguloIsosceles'),
  figure('scalene-triangle', 'Triángulo escaleno', 'TrianguloEscaleno'),
  figure('right-triangle', 'Triángulo rectángulo', 'TrianguloRectangulo'),
  figure('pentagon', 'Pentágono', 'Pentagono'),
  figure('hexagon', 'Hexágono', 'Hexagono'),
  figure('heptagon', 'Heptágono', 'Heptagono'),
  figure('octagon', 'Octágono', 'Octagono'),
  figure('cloud', 'Nube', 'Nube'),
  figure('oval', 'Óvalo', 'Ovalo'),
  figure('diamond', 'Rombo', 'Rombo'),
  figure('parallelogram', 'Paralelogramo', 'Paralelogramo'),
  figure('arrow', 'Flecha', 'Flecha'),
  figure('double-arrow', 'Flecha doble', 'FlechaDoble'),
  figure('arrow-right', 'Flecha derecha', 'FlechaDerecha'),
  figure('arrow-left', 'Flecha izquierda', 'FlechaIzquierda'),
  figure('arrow-up', 'Flecha arriba', 'FlechaArriba'),
  figure('arrow-down', 'Flecha abajo', 'FlechaAbajo'),
  { key: 'frame', label: 'Marco', kind: 'frame', idBase: 'Marco', build: (id, name) => ({ id, name, kind: 'frame', layout: { x: 0, y: 0, width: 320, height: 200 } }) },
];

/** Sub-atributo que trae consigo un atributo compuesto. */
const SUB_ATTRIBUTE: PaletteItem = { key: 'sub-attribute', label: 'Subatributo', kind: 'attribute', idBase: 'Subatributo', build: (id, name) => ({ id, name, kind: 'attribute' }) };

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

/** Distancia en píxeles con la que una figura centrada se corre en diagonal hasta no tapar otra. */
const SHIFT_STEP = 40;

/** Caja de un elemento ya existente: su posición absoluta y su tamaño. */
function boxOf(element: Element): { x: number; y: number; width: number; height: number } {
  const size = element.layout?.width && element.layout.height ? { width: element.layout.width, height: element.layout.height } : measureElement(element);
  return { x: element.layout?.x ?? 0, y: element.layout?.y ?? 0, ...size };
}

/** Esquina superior izquierda de una figura centrada en `center`, corrida en diagonal hasta no tapar ningún elemento. */
export function centeredFreePoint(diagram: Pick<Diagram, 'elements'>, item: PaletteItem, center: Point): Point {
  const size = measureElement(item.build('medida', item.label));
  const boxes = diagram.elements.map(boxOf);
  const origin = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  for (let step = 0; ; step++) {
    const x = origin.x + step * SHIFT_STEP;
    const y = origin.y + step * SHIFT_STEP;
    const free = boxes.every((box) => x + size.width <= box.x || box.x + box.width <= x || y + size.height <= box.y || box.y + box.height <= y);
    if (free) return { x: Math.round(x), y: Math.round(y) };
  }
}

/**
 * Elementos y relaciones que crea soltar una figura. Un atributo compuesto trae dos sub-atributos
 * unidos a él con er-attr; el resto de figuras solo crea elementos.
 */
export function newPaletteEdit(diagram: Pick<Diagram, 'type' | 'elements' | 'relations'>, item: PaletteItem, point: { x: number; y: number }): { elements: Element[]; relations: Relation[] } {
  if (item.key !== 'attribute-composite') return { elements: newPaletteElements(diagram, item, point), relations: [] };
  const owner = placed(diagram, item, point);
  const first = placed({ ...diagram, elements: [...diagram.elements, owner] }, SUB_ATTRIBUTE, { x: point.x - 60, y: point.y + 120 });
  const second = placed({ ...diagram, elements: [...diagram.elements, owner, first] }, SUB_ATTRIBUTE, { x: point.x + 180, y: point.y + 120 });
  const relations: Relation[] = [];
  for (const part of [first, second]) {
    const id = relationId({ elements: [...diagram.elements, owner, first, second], relations: [...diagram.relations, ...relations] });
    relations.push({ id, kind: 'er-attr', source: owner.id, target: part.id });
  }
  return { elements: [owner, first, second], relations };
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
