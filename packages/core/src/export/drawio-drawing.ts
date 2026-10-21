import { type Element } from '../model/diagram.js';
import { xmlElement } from './xml-escape.js';

const r = (n: number) => Math.round(n * 100) / 100;

/** Trazo como un edge libre de draw.io, con los mismos puntos y sin puntas. */
export function drawingXml(
  el: Element,
  parent: string,
  geo: { x: number; y: number },
): string | undefined {
  if (el.kind !== 'drawing') return undefined;
  const points = el.points.map((p) => ({ x: r(geo.x + p.x), y: r(geo.y + p.y) }));
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const middle = points
    .slice(1, -1)
    .map((p) => xmlElement('mxPoint', p))
    .join('');
  const route = middle ? xmlElement('Array', { as: 'points' }, middle) : '';
  const geometry = xmlElement(
    'mxGeometry',
    { relative: '1', as: 'geometry' },
    xmlElement('mxPoint', { x: first.x, y: first.y, as: 'sourcePoint' }) +
      xmlElement('mxPoint', { x: last.x, y: last.y, as: 'targetPoint' }) +
      route,
  );
  return xmlElement(
    'mxCell',
    {
      id: el.id,
      value: el.name,
      style: `edgeStyle=none;html=0;rounded=0;startArrow=none;endArrow=none;strokeColor=${el.strokeColor};strokeWidth=${el.strokeWidth};`,
      edge: '1',
      parent,
    },
    geometry,
  );
}
