import { type Cardinality } from '../model/enums.js';
import { type Element } from '../model/diagram.js';
import { type Relation } from '../model/relation.js';
import { type DrawioCell } from './drawio.js';

/** Flechas nativas de draw.io para cada cardinalidad pata de gallo. */
const ARROWS: Record<Cardinality, string> = {
  one: 'ERmandOne',
  'zero-one': 'ERzeroToOne',
  'one-many': 'ERoneToMany',
  'zero-many': 'ERzeroToMany',
};

/** Entidad ER como rectángulo; la débil usa `shape=ext;double=1` (doble borde). */
export function erCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'entity') return undefined;
  const shape = el.weak ? 'shape=ext;double=1;margin=3;' : '';
  return [{
    id: el.id, parent, value: el.name, vertex: true, geometry: geo,
    style: `${shape}rounded=0;whiteSpace=wrap;html=0;align=center;fontStyle=1;fontSize=14;fillColor=#fffef5;strokeColor=#1f2933;`,
  }];
}

/** Estilo de las puntas de una relación ER; continua si es identificante y discontinua si no. */
export function erEdgeStyle(rel: Relation): string {
  const start = ARROWS[rel.sourceCardinality ?? 'one'];
  const end = ARROWS[rel.targetCardinality ?? 'one'];
  return `startArrow=${start};startFill=0;startSize=10;endArrow=${end};endFill=0;endSize=10;${rel.identifying ? '' : 'dashed=1;'}`;
}
