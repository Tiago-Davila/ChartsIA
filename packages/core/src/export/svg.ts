import { type Diagram } from '../model/diagram.js';
import { type DiagramStyle } from '../model/enums.js';
import { buildScene, FONT_FAMILIES } from '../render/scene.js';
import { primitivesToSvg } from '../render/svg-clean.js';
import { escapeXml } from './xml-escape.js';

/** SVG autocontenido (sin recursos remotos), en estilo limpio o boceto, con leyenda C4. */
export function exportSvg(diagram: Diagram, style: DiagramStyle = diagram.style): string {
  const scene = buildScene(diagram, style);
  const { x, y, width, height } = scene.bounds;
  const groups = [...scene.nodes, ...(scene.legend ? [scene.legend] : [])]
    .map((node) => `<g data-id="${escapeXml(node.id)}" transform="translate(${node.x} ${node.y})">${primitivesToSvg(node.primitives)}</g>`);
  const nodeCount = scene.nodes.length;
  const groupNodes = groups.slice(0, nodeCount);
  const edges = scene.edges.map((e) => `<g data-id="${escapeXml(e.id)}">${primitivesToSvg(e.primitives)}</g>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">`,
    `<title>${escapeXml(diagram.title)}</title>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff"/>`,
    `<g font-family="${escapeXml(FONT_FAMILIES[style])}">`,
    ...groupNodes,
    ...edges,
    ...groups.slice(nodeCount),
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
