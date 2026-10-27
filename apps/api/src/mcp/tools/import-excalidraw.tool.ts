import { z } from 'zod';
import { importExcalidraw, MAX_EXCALIDRAW_SOURCE_LENGTH } from '@chartsia/core/import';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { ProjectIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

const EXAMPLE_SOURCE = JSON.stringify({
  type: 'excalidraw',
  elements: [{ id: 'Servicio', type: 'rectangle', x: 40, y: 40, width: 160, height: 80, boundElements: [{ type: 'text', id: 't1' }] },
    { id: 't1', type: 'text', x: 60, y: 70, width: 100, height: 25, text: 'Servicio', fontSize: 20, containerId: 'Servicio' }],
});

export const importExcalidrawTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'import_excalidraw',
    annotations: { title: 'Importar Excalidraw', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: [
      'Importa un dibujo de Excalidraw (el JSON de un archivo .excalidraw o los elementos copiados desde Excalidraw) a un diagrama nuevo y lo muestra en la app.',
      'Acepta type "excalidraw" y "excalidraw/clipboard", hasta 8 MiB. Conserva rectángulos, elipses y rombos (como figuras con su texto ligado), textos, imágenes incrustadas, marcos, líneas y dibujo libre (como trazos) y flechas unidas a dos elementos (como conectores), con sus posiciones, colores y grosor.',
      'Se omiten con avisos en warnings los elementos borrados, los grupos, la rotación, la opacidad, el relleno rayado y los tipos que el modelo no soporta. Las flechas sin vincular a dos elementos se importan como trazos.',
      'El importador no abre URL ni ejecuta nada del archivo. Pasa el JSON completo como texto en source.',
      'Usa title opcional para fijar el nombre; si se omite, usa "Diagrama importado". projectId solo si la persona pidió agruparlo.',
      'Si el JSON es inválido, no se crea nada y recibes un error con code, path y hint.',
      'Ejemplo de entrada: ' + JSON.stringify({ source: EXAMPLE_SOURCE, title: 'Boceto' }),
    ].join('\n'),
    input: z.strictObject({
      source: z.string().min(1).max(MAX_EXCALIDRAW_SOURCE_LENGTH).describe('JSON de Excalidraw como texto, máximo 8 MiB.'),
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
      const imported = importExcalidraw(source, title);
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
