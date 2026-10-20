import { z } from 'zod';
import { DiagramInputSchema } from '@chartsia/core/model';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { defineTool } from './tool-definition.js';

const EXAMPLE = {
  type: 'class',
  title: 'Pedidos',
  elements: [
    { id: 'Pedido', kind: 'class', name: 'Pedido', attributes: [{ name: 'total', type: 'Decimal', visibility: '-' }], operations: [] },
    { id: 'Linea', kind: 'class', name: 'LineaPedido', attributes: [], operations: [] },
  ],
  relations: [{ id: 'r1', kind: 'composition', source: 'Pedido', target: 'Linea', targetMultiplicity: '1..*' }],
};

export const createDiagramTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'create_diagram',
    annotations: { title: 'Crear diagrama', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    description: [
      'Crea un diagrama de clases UML o C4 (contexto, contenedores o componentes) a partir de una descripción estructural y lo muestra en la app de ChartsIA, donde la persona lo ve al instante.',
      'No envíes coordenadas: el servidor dispone el diagrama automáticamente sin solapes. Solo si quieres fijar un elemento, añade layout {"x","y"}.',
      'Cada elemento y relación lleva un id estable elegido por ti (letra inicial, letras, dígitos, "_" o "-"); úsalo después en apply_changes.',
      'Kinds: class → class, interface, enum, package (grupo). c4-context → person, software-system, boundary. c4-container → además container (variant: default|database|queue|web). c4-component → además component, que debe ir dentro de un boundary con boundaryType "container".',
      'Relaciones UML: association, aggregation, composition (el rombo va en source), inheritance (class→class o interface→interface), realization (class→interface), dependency. En C4 usa solo c4-rel con label y technology.',
      'Si algo es inválido no se crea nada y recibes errores con code, path (JSON Pointer), message y hint para corregirlos. La guía completa por tipo está en el recurso chartsia://schema/{type}.',
      `Ejemplo de entrada: ${JSON.stringify(EXAMPLE)}`,
    ].join('\n'),
    input: DiagramInputSchema,
    output: z.strictObject({
      diagramId: z.string(),
      revision: z.number().int(),
      viewUrl: z.string(),
      counts: z.strictObject({ elements: z.number().int(), relations: z.number().int() }),
      warnings: z.array(z.string()),
    }),
    run: async (args) => {
      const { diagram, warnings } = await commands.create(args);
      const viewUrl = results.viewUrl(diagram.id);
      return {
        linkDiagramId: diagram.id,
        title: diagram.title,
        summary: `Diagrama "${diagram.title}" (${diagram.type}) creado con ${diagram.elements.length} elementos y ${diagram.relations.length} relaciones. Ya es el diagrama activo y se ve en ${viewUrl}`,
        structured: {
          diagramId: diagram.id,
          revision: diagram.revision,
          viewUrl,
          counts: { elements: diagram.elements.length, relations: diagram.relations.length },
          warnings,
        },
      };
    },
  });
