import { type Element } from '../model/diagram.js';
import { type DrawioCell } from './drawio.js';
import { drawioFont, drawioStroke } from './drawio-style.js';
import { FONT } from '../shapes/types.js';

/** Marco contenedor nativo de draw.io; los hijos se anidan en su celda. */
export function frameCells(el: Element, parent: string, geometry: { x: number; y: number; width: number; height: number }): DrawioCell[] | undefined {
  if (el.kind !== 'frame') return undefined;
  const style = drawioFont(
    drawioStroke('rounded=1;arcSize=8;whiteSpace=wrap;html=0;verticalAlign=top;align=left;spacingLeft=20;spacingTop=8;dashed=1;container=1;collapsible=0;fillColor=none;strokeColor=#8492a6;fontColor=#475569;', el.style),
    el.style,
    FONT.name,
  );
  return [{ id: el.id, parent, value: el.name, vertex: true, geometry, style }];
}
