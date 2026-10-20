import { z } from 'zod';
import { EXPORT_FORMATS } from '@chartsia/core/export';
import { DiagramStyleSchema } from '@chartsia/core/model';
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
      'Devuelve el archivo como texto en content y una downloadUrl. Si el archivo supera 512 KiB se omite content: usa downloadUrl o el recurso chartsia://diagrams/{id}/export.{ext}.',
      'style ("clean" o "sketch") cambia el estilo solo para esta exportación. Sin diagramId exporta el diagrama activo.',
      'Ejemplo de entrada: {"format":"svg"}',
    ].join('\n'),
    input: z.strictObject({
      diagramId: DiagramIdSchema.optional(),
      format: z.enum(EXPORT_FORMATS),
      style: DiagramStyleSchema.optional(),
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
      const out = await exports.export(args);
      const downloadUrl = results.downloadUrl(out.diagramId, out.format, args.style);
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
