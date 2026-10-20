import { type ElementOfKind } from '../../model/diagram.js';
import { type ShapeDefinition } from '../types.js';
import { c4Colors } from './palette.js';
import { C4_MIN_HEIGHT, c4TextHeight, c4TextPrimitives, c4Width, type C4Text } from './text-block.js';

type SystemElement = ElementOfKind<'software-system'>;

function text(el: SystemElement): C4Text {
  return {
    name: el.name,
    typeLabel: el.external ? '[Software System - External]' : '[Software System]',
    description: el.description,
  };
}

export const softwareSystemShape: ShapeDefinition<SystemElement> = {
  measure: (el) => {
    const width = c4Width(text(el));
    return { width, height: Math.max(C4_MIN_HEIGHT, c4TextHeight(text(el), width) + 28) };
  },
  primitives: (el, { width, height }) => {
    const colors = c4Colors('software-system', el.external);
    return [
      { type: 'rect', x: 0, y: 0, width, height, rx: 10, fill: colors.fill, stroke: colors.stroke, strokeWidth: 1.5 },
      ...c4TextPrimitives(text(el), { x: 0, y: 0, width, height }, colors.text),
    ];
  },
};
