import { z } from 'zod';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { DiagramIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const undoChangesTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'undo_changes',
    annotations: { title: 'Deshacer o rehacer', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: [
      'Deshace (direction "undo") o rehace (direction "redo") el último cambio de un diagrama, lo haya hecho el agente o la persona en la app.',
      'Úsalo cuando la persona pida volver atrás, por ejemplo para recuperar elementos borrados. La historia guarda hasta 50 pasos desde que arrancó el hub.',
      'Sin diagramId se usa el diagrama activo.',
      'Ejemplo de entrada: {"direction":"undo"}',
    ].join('\n'),
    input: z.strictObject({
      diagramId: DiagramIdSchema.optional(),
      direction: z.enum(['undo', 'redo']),
    }),
    output: z.strictObject({ diagramId: z.string(), revision: z.number().int(), viewUrl: z.string() }),
    run: async ({ diagramId, direction }) => {
      const diagram = await commands.undo({ diagramId, direction, origin: 'agent' });
      const viewUrl = results.viewUrl(diagram.id);
      const verb = direction === 'undo' ? 'Deshecho' : 'Rehecho';
      return {
        linkDiagramId: diagram.id,
        title: diagram.title,
        summary: `${verb} el último cambio de "${diagram.title}" (${diagram.id}), ahora en la revisión ${diagram.revision}. Se ve en ${viewUrl}`,
        structured: { diagramId: diagram.id, revision: diagram.revision, viewUrl },
      };
    },
  });
