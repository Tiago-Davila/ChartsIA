import { z } from 'zod';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { DiagramIdSchema, ProjectIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const moveDiagramTool = (commands: DiagramCommandService) =>
  defineTool({
    name: 'move_diagram',
    annotations: { title: 'Mover diagrama a un proyecto', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Mueve un diagrama a un proyecto existente, o lo saca de su proyecto con projectId null. No modifica el contenido del diagrama.',
      'Úsalo solo si la persona pide organizar diagramas en proyectos; los ids salen de list_diagrams o create_project.',
      'Ejemplo de entrada: {"diagramId":"dg_abcdefghijkl","projectId":"pr_abcdefghijkl"}',
    ].join('\n'),
    input: z.strictObject({ diagramId: DiagramIdSchema, projectId: ProjectIdSchema.nullable() }),
    output: z.strictObject({ diagramId: z.string(), projectId: z.string().nullable() }),
    run: async ({ diagramId, projectId }) => {
      await commands.moveDiagram(diagramId, projectId);
      return {
        summary: projectId ? `Diagrama ${diagramId} movido al proyecto ${projectId}.` : `Diagrama ${diagramId} sin proyecto.`,
        structured: { diagramId, projectId },
      };
    },
  });
