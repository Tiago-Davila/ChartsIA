import { z } from 'zod';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { DiagramIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const deleteDiagramTool = (commands: DiagramCommandService) =>
  defineTool({
    name: 'delete_diagram',
    annotations: { title: 'Eliminar diagrama', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    description: [
      'Elimina un diagrama de forma definitiva, con su historial de deshacer. La app que lo tenga abierto vuelve a la lista.',
      'No se puede deshacer con undo_changes. Úsalo solo si la persona pide borrar el diagrama; los ids salen de list_diagrams.',
      'Ejemplo de entrada: {"diagramId":"dg_abcdefghijkl"}',
    ].join('\n'),
    input: z.strictObject({ diagramId: DiagramIdSchema }),
    output: z.strictObject({ diagramId: z.string() }),
    run: async ({ diagramId }) => {
      await commands.deleteDiagram(diagramId);
      return { summary: `Diagrama ${diagramId} eliminado.`, structured: { diagramId } };
    },
  });
