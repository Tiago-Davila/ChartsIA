import { z } from 'zod';
import { type DiagramQueryService } from '../../diagrams/diagram-query.service.js';
import { SummarySchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const listDiagramsTool = (query: DiagramQueryService) =>
  defineTool({
    name: 'list_diagrams',
    annotations: { title: 'Listar diagramas', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: [
      'Lista todos los diagramas guardados (id, tipo, título, revisión y fecha de modificación, del más reciente al más antiguo) e indica cuál es el diagrama activo.',
      'Úsalo cuando la persona se refiera a un diagrama anterior o haya varios y no esté claro sobre cuál trabajar.',
      'Ejemplo de entrada: {}',
    ].join('\n'),
    input: z.strictObject({}),
    output: z.strictObject({ activeDiagramId: z.string().nullable(), diagrams: z.array(SummarySchema) }),
    run: async () => {
      const list = await query.list();
      const lines = list.diagrams.map((d) => `- ${d.diagramId}${d.diagramId === list.activeDiagramId ? ' (activo)' : ''}: "${d.title}" [${d.type}] rev ${d.revision}`);
      return {
        summary: list.diagrams.length ? `${list.diagrams.length} diagrama(s):\n${lines.join('\n')}` : 'Todavía no hay diagramas. Crea uno con create_diagram.',
        structured: list as unknown as Record<string, unknown>,
      };
    },
  });
