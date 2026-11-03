import { type Diagram } from '../model/diagram.js';
import { buildScene, FONT_FAMILY } from '../render/scene.js';
import { primitivesToSvg } from '../render/svg-clean.js';
import { measureText } from '../shapes/text-metrics.js';
import { DEFAULT_EXPORT_SETTINGS, type ExportSettings } from './options.js';
import { escapeXml } from './xml-escape.js';

const TITLE_SIZE = 20;
const TITLE_BAND = 40;

/** SVG autocontenido (sin recursos remotos), con leyenda C4; usa fondo, margen, escala y título. */
export function exportSvg(diagram: Diagram, settings: ExportSettings = DEFAULT_EXPORT_SETTINGS): string {
  const scene = buildScene(diagram, settings.margin);
  let { x, y, width, height } = scene.bounds;
  let title: string[] = [];
  if (settings.includeTitle) {
    // El título va centrado en una franja sobre el diagrama; si es más ancho que él, la imagen se ensancha a ambos lados.
    const extra = Math.max(0, Math.ceil(measureText(diagram.title, { size: TITLE_SIZE, bold: true })) + 2 * settings.margin - width);
    x -= Math.floor(extra / 2);
    width += extra;
    y -= TITLE_BAND;
    height += TITLE_BAND;
    title = [`<text x="${x + width / 2}" y="${y + 28}" text-anchor="middle" font-size="${TITLE_SIZE}" font-weight="700" fill="#1f2933">${escapeXml(diagram.title)}</text>`];
  }
  const groups = [...scene.nodes, ...(scene.legend ? [scene.legend] : [])]
    .map((node) => `<g data-id="${escapeXml(node.id)}" transform="translate(${node.x} ${node.y})">${primitivesToSvg(node.primitives)}</g>`);
  const nodeCount = scene.nodes.length;
  const groupNodes = groups.slice(0, nodeCount);
  const edges = scene.edges.map((e) => `<g data-id="${escapeXml(e.id)}">${primitivesToSvg(e.primitives)}</g>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width * settings.scale)}" height="${Math.round(height * settings.scale)}" viewBox="${x} ${y} ${width} ${height}">`,
    `<title>${escapeXml(diagram.title)}</title>`,
    ...(settings.background === 'white' ? [`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff"/>`] : []),
    `<g font-family="${escapeXml(FONT_FAMILY)}">`,
    ...title,
    ...groupNodes,
    ...edges,
    ...groups.slice(nodeCount),
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}
