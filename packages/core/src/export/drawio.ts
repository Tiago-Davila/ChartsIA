import { type Point } from '../model/common.js';
import { type Diagram, type Element } from '../model/diagram.js';
import { type Relation } from '../model/relation.js';
import { c4Cells } from './drawio-c4.js';
import { classCells } from './drawio-class.js';
import { erCells, erEdgeStyle } from './drawio-er.js';
import { figureCells } from './drawio-figure.js';
import { drawingXml } from './drawio-drawing.js';
import { drawioFont, drawioStroke } from './drawio-style.js';
import { xmlElement } from './xml-escape.js';
import { FONT } from '../shapes/types.js';

export interface DrawioCell {
  id: string;
  parent: string;
  style: string;
  value?: string;
  vertex?: boolean;
  edge?: boolean;
  source?: string;
  target?: string;
  geometry: { x: number; y: number; width: number; height: number };
  /** Atributos de `UserObject` (draw.io `<object>`), p. ej. los campos C4. */
  object?: Record<string, string>;
}

const r = (n: number) => Math.round(n * 100) / 100;

const EDGE_STYLES: Record<Relation['kind'], string> = {
  inheritance: 'endArrow=block;endFill=0;endSize=14;',
  realization: 'endArrow=block;endFill=0;endSize=14;dashed=1;',
  composition: 'startArrow=diamondThin;startFill=1;startSize=16;endArrow=none;',
  aggregation: 'startArrow=diamondThin;startFill=0;startSize=16;endArrow=none;',
  dependency: 'endArrow=open;endSize=12;dashed=1;',
  association: 'endArrow=none;',
  'c4-rel': 'endArrow=blockThin;endFill=1;endSize=12;strokeColor=#707070;fontColor=#404040;dashed=1;',
  'er-rel': 'endArrow=none;',
  'er-attr': 'endArrow=none;',
  connector: 'endArrow=open;endSize=12;',
};

function vertexXml(cell: DrawioCell): string {
  const g = cell.geometry;
  const geometry = xmlElement('mxGeometry', { x: r(g.x), y: r(g.y), width: r(g.width), height: r(g.height), as: 'geometry' });
  if (cell.object) {
    const inner = xmlElement('mxCell', { style: cell.style, vertex: '1', parent: cell.parent }, geometry);
    return xmlElement('object', { ...cell.object, id: cell.id }, inner);
  }
  return xmlElement('mxCell', { id: cell.id, value: cell.value ?? '', style: cell.style, vertex: '1', parent: cell.parent }, geometry);
}

/** Restricción de puerto (exitX/entryX) a partir del punto de la ruta sobre el borde del nodo. */
function constraint(prefix: 'exit' | 'entry', p: Point, l: Element['layout']): string {
  if (!l || !l.width || !l.height) return '';
  const fx = r((p.x - l.x) / l.width);
  const fy = r((p.y - l.y) / l.height);
  return `${prefix}X=${fx};${prefix}Y=${fy};${prefix}Dx=0;${prefix}Dy=0;`;
}

/** Puntas y trazo de un conector libre: sin punta, en el destino (defecto) o en ambos extremos. */
function connectorEdgeStyle(rel: Relation): string {
  const heads = rel.arrowheads ?? 'end';
  const start = heads === 'both' ? 'startArrow=open;startSize=12;' : '';
  const end = heads === 'none' ? 'endArrow=none;' : 'endArrow=open;endSize=12;';
  return `${start}${end}${rel.dashed ? 'dashed=1;' : ''}`;
}

function edgeXml(rel: Relation, byId: Map<string, Element>): string {
  const route = rel.route ?? [];
  const src = byId.get(rel.source);
  const tgt = byId.get(rel.target);
  let style = `${EDGE_STYLES[rel.kind]}html=0;rounded=0;edgeStyle=none;orthogonal=1;fontSize=11;labelBackgroundColor=#ffffff;`;
  if (rel.kind === 'er-rel') style = style.replace('endArrow=none;', erEdgeStyle(rel));
  if (rel.kind === 'connector') style = style.replace('endArrow=open;endSize=12;', connectorEdgeStyle(rel));
  if (rel.kind === 'association' && rel.navigable === 'source-to-target') style = style.replace('endArrow=none;', 'endArrow=open;endSize=12;');
  style = drawioFont(drawioStroke(style, rel.style), rel.style, FONT.small);
  if (route.length >= 2) style += constraint('exit', route[0]!, src?.layout) + constraint('entry', route[route.length - 1]!, tgt?.layout);
  const label = [rel.label, rel.kind === 'c4-rel' && rel.technology ? `[${rel.technology}]` : undefined].filter(Boolean).join('\n');
  const points = route.slice(1, -1).map((p) => xmlElement('mxPoint', { x: r(p.x), y: r(p.y) })).join('');
  const geometry = xmlElement('mxGeometry', { relative: '1', as: 'geometry' }, points ? xmlElement('Array', { as: 'points' }, points) : '');
  const cells = [xmlElement('mxCell', { id: rel.id, value: label, style, edge: '1', parent: '1', source: rel.source, target: rel.target }, geometry)];
  const end = (text: string | undefined, x: number, suffix: string, align: string) => {
    if (!text) return;
    const g = xmlElement('mxGeometry', { x, relative: '1', as: 'geometry' }, xmlElement('mxPoint', { x: x < 0 ? 10 : -10, y: -10, as: 'offset' }));
    cells.push(xmlElement('mxCell', { id: `${rel.id}:${suffix}`, value: text, style: drawioFont(`edgeLabel;resizable=0;html=0;align=${align};verticalAlign=bottom;fontSize=11;`, rel.style, FONT.small), vertex: '1', connectable: '0', parent: rel.id }, g));
  };
  end(rel.sourceMultiplicity, -1, 'source', 'left');
  end(rel.targetMultiplicity, 1, 'target', 'right');
  return cells.join('');
}

/**
 * Exporta a draw.io (`.drawio`): `<mxfile><diagram><mxGraphModel>` sin comprimir. Las
 * coordenadas de los hijos son relativas a su contenedor, como espera draw.io.
 */
export function exportDrawio(diagram: Diagram): string {
  const byId = new Map(diagram.elements.map((e) => [e.id, e]));
  const depth = (el: Element): number => (el.parentId && byId.has(el.parentId) ? 1 + depth(byId.get(el.parentId)!) : 0);
  const ordered = [...diagram.elements].sort((a, b) => depth(a) - depth(b) || (a.id < b.id ? -1 : 1));
  const cells: string[] = [xmlElement('mxCell', { id: '0' }), xmlElement('mxCell', { id: '1', parent: '0' })];
  for (const el of ordered) {
    const l = el.layout ?? { x: 0, y: 0, width: 120, height: 60 };
    const parentEl = el.parentId ? byId.get(el.parentId) : undefined;
    const geo = {
      x: l.x - (parentEl?.layout?.x ?? 0),
      y: l.y - (parentEl?.layout?.y ?? 0),
      width: l.width ?? 120,
      height: l.height ?? 60,
    };
    const parent = parentEl ? parentEl.id : '1';
    const drawing = drawingXml(el, parent, geo);
    if (drawing) {
      cells.push(drawing);
      continue;
    }
    const vertices = classCells(el, parent, geo) ?? c4Cells(el, parent, geo) ?? erCells(el, parent, geo) ?? figureCells(el, parent, geo) ?? [];
    cells.push(...vertices.map(vertexXml));
  }
  for (const rel of [...diagram.relations].sort((a, b) => (a.id < b.id ? -1 : 1))) cells.push(edgeXml(rel, byId));

  const model = xmlElement(
    'mxGraphModel',
    { dx: 0, dy: 0, grid: 1, gridSize: 10, guides: 1, tooltips: 1, connect: 1, arrows: 1, fold: 1, page: 0, pageScale: 1, math: 0, shadow: 0 },
    xmlElement('root', {}, cells.join('\n')),
  );
  const file = xmlElement(
    'mxfile',
    { host: 'ChartsIA', modified: diagram.updatedAt, agent: 'ChartsIA', version: '24.0.0', type: 'device' },
    xmlElement('diagram', { id: diagram.id, name: diagram.title }, model),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${file}\n`;
}
