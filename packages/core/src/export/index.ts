import { type Diagram } from '../model/diagram.js';
import { exportDrawio } from './drawio.js';
import { exportExcalidraw } from './excalidraw.js';
import { DEFAULT_EXPORT_SETTINGS, type ExportFormat, type ExportSettings } from './options.js';
import { exportSvg } from './svg.js';

export const MIME_TYPES: Record<ExportFormat, string> = {
  svg: 'image/svg+xml',
  drawio: 'application/vnd.jgraph.mxfile',
  excalidraw: 'application/vnd.excalidraw+json',
};

export interface ExportResult {
  format: ExportFormat;
  mimeType: string;
  filename: string;
  content: string;
}

/** Nombre de archivo seguro (ASCII, sin rutas) a partir del título. */
export function exportFilename(title: string, format: ExportFormat): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return `${slug || 'diagrama'}.${format}`;
}

/** Exporta en el formato pedido; sin opciones usa las de siempre. */
export function exportDiagram(diagram: Diagram, format: ExportFormat, settings: ExportSettings = DEFAULT_EXPORT_SETTINGS): ExportResult {
  const content = format === 'svg' ? exportSvg(diagram, settings) : format === 'drawio' ? exportDrawio(diagram, settings) : exportExcalidraw(diagram, settings);
  return { format, mimeType: MIME_TYPES[format], filename: exportFilename(diagram.title, format), content };
}

export { exportDrawio } from './drawio.js';
export { exportExcalidraw } from './excalidraw.js';
export * from './options.js';
export { exportSvg } from './svg.js';
export { escapeXml } from './xml-escape.js';
