import { type Element } from '../model/diagram.js';
import { type ElementKind } from '../model/enums.js';
import { boundaryShape } from './c4/boundary.js';
import { componentShape } from './c4/component.js';
import { containerShape } from './c4/container.js';
import { attributeShape } from './er/attribute.js';
import { entityShape } from './er/entity.js';
import { figureShape } from './general/figure.js';
import { tableShape } from './er/table.js';
import { valueListShape } from './er/value-list.js';
import { personShape } from './c4/person.js';
import { softwareSystemShape } from './c4/software-system.js';
import { type Primitive, type ShapeDefinition, type Size } from './types.js';
import { classShape } from './uml/class.js';
import { enumShape } from './uml/enum.js';
import { interfaceShape } from './uml/interface.js';
import { packageShape } from './uml/package.js';

const SHAPES: { [K in ElementKind]: ShapeDefinition<Extract<Element, { kind: K }>> } = {
  class: classShape,
  interface: interfaceShape,
  enum: enumShape,
  package: packageShape,
  person: personShape,
  'software-system': softwareSystemShape,
  container: containerShape,
  component: componentShape,
  boundary: boundaryShape,
  entity: entityShape,
  table: tableShape,
  figure: figureShape,
  attribute: attributeShape,
  'value-list': valueListShape,
};

export function shapeFor<E extends Element>(element: E): ShapeDefinition<E> {
  return SHAPES[element.kind] as unknown as ShapeDefinition<E>;
}

/** Tamaño natural de un elemento (en grupos, el mínimo sin contar a sus hijos). */
export function measureElement(element: Element): Size {
  return shapeFor(element).measure(element);
}

export function elementPrimitives(element: Element, size: Size): Primitive[] {
  return shapeFor(element).primitives(element, size);
}

const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

export function groupPadding(element: Element) {
  return shapeFor(element).padding?.(element) ?? NO_PADDING;
}
