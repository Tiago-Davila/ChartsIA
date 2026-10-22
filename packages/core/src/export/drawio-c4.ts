import { type Element } from '../model/diagram.js';
import { C4_PALETTE } from '../shapes/c4/palette.js';
import { FONT } from '../shapes/types.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

const POINTS = 'points=[[0,0,0],[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[1,1,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]];';
const COMMON = 'whiteSpace=wrap;html=0;align=center;metaEdit=1;labelBackgroundColor=none;fontSize=12;';
const LABEL = '%c4Name%\n[%c4Type%]\n\n%c4Description%';
const LABEL_TECH = '%c4Name%\n[%c4Type%: %c4Technology%]\n\n%c4Description%';

function colors(kind: 'person' | 'software-system' | 'container' | 'component', external?: boolean) {
  const c = external ? C4_PALETTE.external : C4_PALETTE[kind];
  return `fillColor=${c.fill};strokeColor=${c.stroke};fontColor=${c.text};`;
}

/**
 * Elementos C4 como `UserObject` con `c4Name`, `c4Type`, `c4Description` y `c4Technology`
 * y formas `mxgraph.c4.*`, igual que la librería C4 de draw.io. Las etiquetas usan
 * marcadores de posición y `html=0`, así ningún texto se interpreta como HTML.
 */
export function c4Cells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  const cells = c4BaseCells(el, parent, geo);
  return cells?.map((cell) => ({ ...cell, style: drawioFont(drawioBox(cell.style, el.style), el.style, FONT.c4Description) }));
}

/** Celdas C4 con la paleta y la fuente por defecto. */
function c4BaseCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  const object = (c4Type: string, label: string, technology?: string) => ({
    placeholders: '1', label, c4Name: el.name, c4Type, c4Description: el.description ?? '', ...(technology !== undefined ? { c4Technology: technology } : {}),
  });
  switch (el.kind) {
    case 'person':
      return [{ id: el.id, parent, vertex: true, geometry: geo, object: object(el.external ? 'Person - External' : 'Person', LABEL),
        style: `shape=mxgraph.c4.person2;${COMMON}${colors('person', el.external)}${POINTS}resizable=0;` }];
    case 'software-system':
      return [{ id: el.id, parent, vertex: true, geometry: geo, object: object(el.external ? 'Software System - External' : 'Software System', LABEL),
        style: `rounded=1;arcSize=10;${COMMON}${colors('software-system', el.external)}${POINTS}` }];
    case 'container': {
      const shape =
        el.variant === 'database' ? 'shape=cylinder3;size=15;boundedLbl=1;'
          : el.variant === 'queue' ? 'shape=cylinder3;direction=south;size=10;boundedLbl=1;'
            : el.variant === 'web' ? 'shape=mxgraph.c4.webBrowserContainer2;'
              : 'rounded=1;arcSize=6;';
      return [{ id: el.id, parent, vertex: true, geometry: geo, object: object('Container', el.technology ? LABEL_TECH : LABEL, el.technology),
        style: `${shape}${COMMON}${colors('container')}${POINTS}` }];
    }
    case 'component':
      return [{ id: el.id, parent, vertex: true, geometry: geo, object: object('Component', el.technology ? LABEL_TECH : LABEL, el.technology),
        style: `rounded=1;arcSize=6;${COMMON}${colors('component')}${POINTS}` }];
    case 'boundary': {
      const type = { enterprise: 'Enterprise', system: 'Software System', container: 'Container' }[el.boundaryType];
      return [{ id: el.id, parent, vertex: true, geometry: geo, object: { placeholders: '1', label: '%c4Name%\n[%c4Type%]', c4Name: el.name, c4Type: type },
        style: 'rounded=1;arcSize=2;absoluteArcSize=1;dashed=1;dashPattern=8 4;fillColor=none;strokeColor=#444444;fontColor=#444444;whiteSpace=wrap;html=0;align=left;verticalAlign=top;spacing=10;fontSize=12;fontStyle=1;metaEdit=1;container=1;collapsible=0;recursiveResize=0;' }];
    }
    default:
      return undefined;
  }
}
