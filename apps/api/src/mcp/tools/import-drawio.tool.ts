import { z } from 'zod';
import { importDrawio, MAX_DRAWIO_SOURCE_LENGTH } from '@chartsia/core/import';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { ProjectIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

const EXAMPLE_SOURCE =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="Servidor" value="Servidor" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>';

export const importDrawioTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'import_drawio',
    annotations: { title: 'Importar draw.io', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: [
      'Importa un diagrama de draw.io (.drawio o un mxGraphModel copiado) a un diagrama canónico nuevo y lo muestra en la app.',
      'Acepta XML sin comprimir o comprimido (deflate + base64, también codificado como URL), hasta 4 Mi caracteres. Con varias páginas importa la primera y avisa de las demás.',
      'Conserva clases con sus miembros, elementos C4, ER y NoSQL, figuras, textos, marcos, imágenes embebidas, trazos y aristas con origen y destino, y las posiciones. Las rutas de las aristas se recalculan. Lo que no tiene equivalente se omite y queda en warnings.',
      'El importador rechaza DOCTYPE y entidades, no interpreta HTML ni descarga URL. No envíes contenido remoto.',
      'Usa title opcional para fijar el nombre; si se omite, toma el nombre de la página o usa "Diagrama importado". projectId solo si la persona pidió agruparlo.',
      'Si el XML no es válido, no se crea nada y recibes un error con /source, code, message y hint.',
      'Ejemplo de entrada: ' + JSON.stringify({ source: EXAMPLE_SOURCE, title: 'Servidor' }),
    ].join('\n'),
    input: z.strictObject({
      source: z.string().min(1).max(MAX_DRAWIO_SOURCE_LENGTH).describe('XML de draw.io (<mxfile> o <mxGraphModel>), sin comprimir o comprimido, máximo 4 Mi caracteres.'),
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
      const imported = await importDrawio(source, title);
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
