import { z } from 'zod';
import { MAX_MERMAID_SOURCE_LENGTH } from '@chartsia/core/import';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { parseMermaidImport } from '../../diagrams/mermaid-import.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { ProjectIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

export const importMermaidTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'import_mermaid',
    annotations: { title: 'Importar Mermaid', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: [
      'Importa texto Mermaid classDiagram/classDiagram-v2 a un diagrama UML canónico nuevo y lo muestra en la app.',
      'Acepta hasta 256 Ki caracteres. Conserva clases, miembros, namespaces y relaciones; las directivas visuales se omiten con avisos. Las relaciones Mermaid de dos extremos, lollipop y algunas multiplicidades se aproximan en el modelo y se explican en warnings.',
      'El importador no interpreta HTML, ejecuta callbacks ni abre o consulta URL. No envíes contenido remoto ni instrucciones fuera de classDiagram.',
      'Usa title opcional para fijar el nombre; si se omite, toma el title del front matter o usa "Diagrama importado". projectId solo si la persona pidió agruparlo.',
      'Si hay sintaxis inválida, no se crea nada y recibes un error con /source y número de línea cuando está disponible.',
      'Ejemplo de entrada: ' + JSON.stringify({ source: 'classDiagram\n  class Usuario {\n    +String nombre\n    +iniciarSesion() bool\n  }', title: 'Usuarios' }),
    ].join('\n'),
    input: z.strictObject({
      source: z.string().min(1).max(MAX_MERMAID_SOURCE_LENGTH).describe('Texto classDiagram de Mermaid, máximo 256 Ki caracteres.'),
      title: z.string().min(1).max(120).optional(),
      projectId: ProjectIdSchema.optional(),
    }),
    output: z.strictObject({
      diagramId: z.string(),
      revision: z.number().int(),
      viewUrl: z.string(),
      counts: z.strictObject({ elements: z.number().int(), relations: z.number().int() }),
      warnings: z.array(z.string()),
    }),
    run: async ({ source, title, projectId }) => {
      const imported = parseMermaidImport(source, title);
      const { diagram, warnings } = await commands.create(imported.diagram, projectId);
      const viewUrl = results.viewUrl(diagram.id);
      return {
        linkDiagramId: diagram.id,
        title: diagram.title,
        summary: 'Diagrama "' + diagram.title + '" importado con ' + diagram.elements.length + ' elementos y ' + diagram.relations.length + ' relaciones. Ya es el diagrama activo y se ve en ' + viewUrl,
        structured: {
          diagramId: diagram.id,
          revision: diagram.revision,
          viewUrl,
          counts: { elements: diagram.elements.length, relations: diagram.relations.length },
          warnings: [...imported.warnings, ...warnings],
        },
      };
    },
  });
