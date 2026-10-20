import { z } from 'zod';
import { DiagramSchema } from '@chartsia/core/model';
import { type DiagramQueryService } from '../../diagrams/diagram-query.service.js';
import { DiagramIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const getDiagramTool = (query: DiagramQueryService) =>
  defineTool({
    name: 'get_diagram',
    annotations: { title: 'Leer diagrama', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Devuelve el estado actual de un diagrama: tipo, título, estilo, revisión, elementos y relaciones con sus ids.',
      'Úsalo antes de modificar un diagrama para conocer los ids exactos y la revisión; refleja también las ediciones que la persona hizo a mano en la app.',
      'Sin diagramId devuelve el diagrama activo. Con includeLayout: true incluye posiciones (layout) y rutas (route) calculadas por el servidor.',
      'Ejemplo de entrada: {"includeLayout":false}',
    ].join('\n'),
    input: z.strictObject({
      diagramId: DiagramIdSchema.optional(),
      includeLayout: z.boolean().optional().describe('Por defecto false'),
    }),
    output: DiagramSchema,
    run: async (args) => {
      const diagram = await query.get(args.diagramId, args.includeLayout ?? false);
      return {
        summary: `Diagrama "${diagram.title}" (${diagram.id}, ${diagram.type}, revisión ${diagram.revision}): ${diagram.elements.length} elementos y ${diagram.relations.length} relaciones.\n${JSON.stringify(diagram)}`,
        structured: diagram as unknown as Record<string, unknown>,
      };
    },
  });
