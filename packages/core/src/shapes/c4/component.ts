import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { paintOf } from '../style.js';
import { c4Colors } from './palette.js';
import { C4_MIN_HEIGHT, c4TextHeight, c4TextPrimitives, c4Width, type C4Text, typeLabel } from './text-block.js';

type ComponentElement = ElementOfKind<'component'>;

function text(el: ComponentElement): C4Text {
  return { name: el.name, typeLabel: typeLabel('Component', el.technology), description: el.description, style: el.style };
}

export const componentShape: ShapeDefinition<ComponentElement> = {
  measure: (el) => {
    const width = c4Width(text(el));
    return { width, height: Math.max(C4_MIN_HEIGHT, c4TextHeight(text(el), width) + 28) };
  },
  primitives: (el, { width, height }) => {
    const c = paintOf(el.style, c4Colors('component'));
    return [
      { type: 'rect', x: 0, y: 0, width, height, rx: 6, fill: c.fill, stroke: c.stroke, strokeWidth: 1.5 },
      ...c4TextPrimitives(text(el), { x: 0, y: 0, width, height }, c.text),
    ];
  },
};
