import { type Element } from '../model/diagram.js';
import { boxGeometry, type CompartmentBox } from '../shapes/uml/compartments.js';
import { tableBox } from '../shapes/er/table.js';
import { valueListBox } from '../shapes/er/value-list.js';
import { FONT } from '../shapes/types.js';
import { classBox } from '../shapes/uml/class.js';
import { enumBox } from '../shapes/uml/enum.js';
import { interfaceBox } from '../shapes/uml/interface.js';
import { tabHeight } from '../shapes/uml/package.js';
import { type DrawioCell } from './drawio.js';
import { drawioBox, drawioFont } from './drawio-style.js';

const MEMBER = 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=0;fontSize=13;';
const SEPARATOR = 'line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=inherit;html=0;';

function boxFor(el: Element): CompartmentBox | undefined {
  if (el.kind === 'class') return classBox(el);
  if (el.kind === 'interface') return interfaceBox(el);
  if (el.kind === 'enum') return enumBox(el);
  if (el.kind === 'table') return tableBox(el);
  if (el.kind === 'value-list') return valueListBox(el);
  return undefined;
}

/** Clase/interfaz/enum/tabla como `swimlane` con `stackLayout` y una celda por miembro (mxUML25). */
export function classCells(el: Element, parent: string, geo: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind === 'package') {
    return [{
      id: el.id, parent, value: el.name, vertex: true, geometry: geo,
      style: drawioFont(
        drawioBox(`shape=folder;fontStyle=1;spacingTop=10;tabWidth=80;tabHeight=${tabHeight(el)};tabPosition=left;html=0;whiteSpace=wrap;verticalAlign=top;align=left;spacingLeft=10;container=1;collapsible=0;fillColor=none;`, el.style),
        el.style,
        FONT.name,
      ),
    }];
  }
  const box = boxFor(el);
  if (!box) return undefined;
  const g = boxGeometry(box);
  const header = box.header.map((l) => l.text).join('\n');
  const italic = box.header.some((l) => l.slot === 'name' && l.italic);
  const cells: DrawioCell[] = [{
    id: el.id, parent, value: header, vertex: true, geometry: geo,
    style: drawioFont(
      drawioBox(`swimlane;fontStyle=${italic ? 3 : 1};align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=${g.headerHeight};horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=0;whiteSpace=wrap;fillColor=#fff6d6;swimlaneFillColor=#fffef5;strokeColor=#1f2933;fontSize=14;`, el.style),
      el.style,
      FONT.name,
    ),
  }];
  g.sections.forEach((section, s) => {
    if (s > 0) {
      cells.push({ id: `${el.id}:sep:${s}`, parent: el.id, value: '', vertex: true, style: SEPARATOR, geometry: { x: 0, y: section.top - 4, width: geo.width, height: 8 } });
    }
    section.lines.forEach((line, i) => {
      const fontStyle = (line.line.bold ? 1 : 0) + (line.line.italic ? 2 : 0) + (line.line.underline ? 4 : 0);
      cells.push({
        id: `${el.id}:${line.line.slot ?? `${s}:${i}`}`, parent: el.id, value: line.line.text, vertex: true,
        style: drawioFont(MEMBER + (fontStyle ? `fontStyle=${fontStyle};` : ''), el.style, FONT.member),
        geometry: { x: 0, y: line.y, width: geo.width, height: line.height },
      });
    });
  });
  return cells;
}
