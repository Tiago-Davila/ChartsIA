import { z } from 'zod';
import { EXPORT_FORMATS, ExportPreferenceChangesSchema } from '@chartsia/core/export';
import { type ExportService } from '../../diagrams/export.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { DiagramIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const exportDiagramTool = (exports: ExportService, results: ToolResultFormatter) =>
  defineTool({
    name: 'export_diagram',
    annotations: { title: 'Exportar diagrama', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Exporta un diagrama a SVG (imagen), draw.io (.drawio, editable en app.diagrams.net) o Excalidraw (.excalidraw, editable en excalidraw.com).',
      'Sin format usa el formato por defecto y las opciones guardadas en las preferencias de exportación (se leen y cambian con set_preferences, campo export). Cada opción que envíes (format, background, margin, scale, includeTitle) vale solo para esta llamada.',
      'background (white o transparent) vale en los tres formatos; margin (px), scale e includeTitle solo en SVG, porque draw.io y Excalidraw tienen lienzo infinito y llevan el título en el archivo.',
      'Devuelve el archivo como texto en content y una downloadUrl. Si el archivo supera 512 KiB se omite content: usa downloadUrl o el recurso chartsia://diagrams/{id}/export.{ext}.',
      'Sin diagramId exporta el diagrama activo.',
      'Ejemplo de entrada: {"format":"svg","background":"transparent","includeTitle":true}',
    ].join('\n'),
    input: z.strictObject({
      diagramId: DiagramIdSchema.optional(),
      ...ExportPreferenceChangesSchema.shape,
    }),
    output: z.strictObject({
      diagramId: z.string(),
      format: z.enum(EXPORT_FORMATS),
      mimeType: z.string(),
      filename: z.string(),
      downloadUrl: z.string(),
      content: z.string().optional(),
    }),
    run: async (args) => {
      const { diagramId, format, ...settings } = args;
      const out = await exports.export({ diagramId, format, settings });
      const downloadUrl = results.downloadUrl(out.diagramId, out.format, settings);
      return {
        summary: out.tooLargeToInline
          ? `Exportado ${out.filename} (${out.mimeType}). Es demasiado grande para devolverlo aquí: descárgalo en ${downloadUrl}`
          : `Exportado ${out.filename} (${out.mimeType}). También disponible en ${downloadUrl}`,
        structured: {
          diagramId: out.diagramId,
          format: out.format,
          mimeType: out.mimeType,
          filename: out.filename,
          downloadUrl,
          ...(out.tooLargeToInline ? {} : { content: out.content }),
        },
      };
    },
  });
