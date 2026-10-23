import { type Cardinality } from '../model/enums.js';
import { type Element } from '../model/diagram.js';
import { type Relation } from '../model/relation.js';
import { textFont } from '../shapes/style.js';
import { IDENTIFYING_GAP, rhombusPoints } from '../shapes/er/relationship.js';
import { TRIANGLE_HEIGHT, TRIANGLE_WIDTH } from '../shapes/er/specialization.js';
import { FONT } from '../shapes/types.js';
import { lineHeight, measureText } from '../shapes/text-metrics.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

/** Alto de la celda del subrayado discontinuo; una celda sin alto no se puede seleccionar en draw.io. */
const UNDERLINE_HEIGHT = 4;

/** Flechas nativas de draw.io para cada cardinalidad pata de gallo. */
const ARROWS: Record<Cardinality, string> = {
  one: 'ERmandOne',
  'zero-one': 'ERzeroToOne',
  'one-many': 'ERoneToMany',
  'zero-many': 'ERzeroToMany',
};

type Geo = { x: number; y: number; width: number; height: number };

/** Figuras ER: entidad (débil y asociativa), atributo Chen (óvalo), relación (rombo) y especialización (triángulo). */
export function erCells(el: Element, parent: string, geo: Geo): DrawioCell[] | undefined {
  if (el.kind === 'attribute') return attributeCells(el, parent, geo);
  if (el.kind === 'relationship') return relationshipCells(el, parent, geo);
  if (el.kind === 'specialization') return specializationCells(el, parent, geo);
  if (el.kind !== 'entity') return undefined;
  const shape = el.weak ? 'shape=ext;double=1;margin=3;' : '';
  const dashed = el.associative ? 'dashed=1;' : '';
  return [{
    id: el.id, parent, value: el.name, vertex: true, geometry: geo,
    style: drawioFont(
      drawioBox(`${shape}${dashed}rounded=0;whiteSpace=wrap;html=0;align=center;fontStyle=1;fontSize=14;fillColor=#fffef5;strokeColor=#1f2933;`, el.style),
      el.style,
      FONT.name,
    ),
  }];
}

/** Atributo Chen como óvalo (doble si es multivaluado); la clave parcial añade una línea discontinua bajo el nombre. */
function attributeCells(el: Extract<Element, { kind: 'attribute' }>, parent: string, geo: Geo): DrawioCell[] {
  const shape = el.multivalued ? 'shape=doubleEllipse;' : 'ellipse;';
  const oval: DrawioCell = {
    id: el.id, parent, value: el.name, vertex: true, geometry: geo,
    style: drawioFont(
      drawioBox(`${shape}whiteSpace=wrap;html=0;align=center;fontSize=13;${el.key ? 'fontStyle=4;' : ''}${el.derived ? 'dashed=1;' : ''}fillColor=#fffef5;strokeColor=#1f2933;`, el.style),
      el.style,
      FONT.member,
    ),
  };
  if (!el.partialKey) return [oval];
  const font = textFont(el.style, FONT.member);
  const width = measureText(el.name, font);
  // `shape=line` dibuja la raya en el medio de la celda, así que se le da algo de alto alrededor de esa altura.
  const y = geo.y + geo.height / 2 + lineHeight(font.size) / 4 + 3 - UNDERLINE_HEIGHT / 2;
  const underline: DrawioCell = {
    id: `${el.id}-partial-key`, parent, vertex: true, value: '',
    style: 'shape=line;strokeColor=#1f2933;dashed=1;dashPattern=4 3;',
    geometry: { x: geo.x + (geo.width - width) / 2, y, width, height: UNDERLINE_HEIGHT },
  };
  return [oval, underline];
}

/** Relación Chen como rombo; la identificante añade un segundo rombo interior sin relleno. */
function relationshipCells(el: Extract<Element, { kind: 'relationship' }>, parent: string, geo: Geo): DrawioCell[] {
  const cells: DrawioCell[] = [{
    id: el.id, parent, value: el.name, vertex: true, geometry: geo,
    style: drawioFont(
      drawioBox('shape=rhombus;perimeter=rhombusPerimeter;rounded=0;whiteSpace=wrap;html=0;align=center;fontSize=13;fillColor=#fffef5;strokeColor=#1f2933;', el.style),
      el.style,
      FONT.name,
    ),
  }];
  if (el.identifying) {
    const [top, right, bottom, left] = rhombusPoints(geo.width, geo.height, IDENTIFYING_GAP);
    const width = right!.x - left!.x;
    const height = bottom!.y - top!.y;
    cells.push({
      id: `${el.id}-inner`, parent, value: '', vertex: true,
      geometry: { x: geo.x + (geo.width - width) / 2, y: geo.y + (geo.height - height) / 2, width, height },
      style: 'shape=rhombus;perimeter=rhombusPerimeter;fillColor=none;strokeColor=#1f2933;',
    });
  }
  return cells;
}

/** Especialización como triángulo con la letra d u o dentro y el nombre debajo. */
function specializationCells(el: Extract<Element, { kind: 'specialization' }>, parent: string, geo: Geo): DrawioCell[] {
  const cx = geo.x + geo.width / 2;
  return [
    {
      id: el.id, parent, value: '', vertex: true,
      geometry: { x: cx - TRIANGLE_WIDTH / 2, y: geo.y, width: TRIANGLE_WIDTH, height: TRIANGLE_HEIGHT },
      style: drawioBox('shape=triangle;direction=north;whiteSpace=wrap;html=0;fillColor=#fffef5;strokeColor=#1f2933;', el.style),
    },
    {
      id: `${el.id}-kind`, parent, value: el.overlapping ? 'o' : 'd', vertex: true,
      geometry: { x: cx - 10, y: geo.y + TRIANGLE_HEIGHT * 0.8 - 10, width: 20, height: 20 },
      style: 'text;html=0;align=center;verticalAlign=middle;fontStyle=1;fontSize=12;',
    },
    {
      id: `${el.id}-name`, parent, value: el.name, vertex: true,
      geometry: { x: geo.x, y: geo.y + TRIANGLE_HEIGHT + 4, width: geo.width, height: geo.height - TRIANGLE_HEIGHT - 4 },
      style: drawioFont('text;html=0;align=center;verticalAlign=top;whiteSpace=wrap;', el.style, FONT.name),
    },
  ];
}

/** Estilo de las puntas de una relación ER; continua si es identificante y discontinua si no. */
export function erEdgeStyle(rel: Relation): string {
  const start = ARROWS[rel.sourceCardinality ?? 'one'];
  const end = ARROWS[rel.targetCardinality ?? 'one'];
  return `startArrow=${start};startFill=0;startSize=10;endArrow=${end};endFill=0;endSize=10;${rel.identifying ? '' : 'dashed=1;'}`;
}
