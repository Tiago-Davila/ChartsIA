import { z } from 'zod';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { DiagramIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const openDiagramTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'open_diagram',
    annotations: { title: 'Abrir diagrama', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Convierte un diagrama existente en el diagrama activo y hace que la app de ChartsIA navegue a él. No modifica su contenido.',
      'Úsalo cuando la persona quiera volver a un diagrama anterior: las siguientes llamadas sin diagramId trabajarán sobre él.',
      'Ejemplo de entrada: {"diagramId":"dg_abcdefghijkl"}',
    ].join('\n'),
    input: z.strictObject({ diagramId: DiagramIdSchema }),
    output: z.strictObject({ diagramId: z.string(), viewUrl: z.string() }),
    run: async ({ diagramId }) => {
      await commands.activate(diagramId);
      const viewUrl = results.viewUrl(diagramId);
      return { summary: `Diagrama ${diagramId} abierto y activo: ${viewUrl}`, structured: { diagramId, viewUrl } };
    },
  });
