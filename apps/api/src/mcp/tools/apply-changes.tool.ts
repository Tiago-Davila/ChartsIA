import { z } from 'zod';
import { OperationBatchSchema } from '@chartsia/core/model';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { DiagramIdSchema } from './schemas.js';
import { defineTool } from './tool-definition.js';

const EXAMPLE = {
  operations: [
    { op: 'add_element', element: { id: 'Cliente', kind: 'class', name: 'Cliente', attributes: [], operations: [] } },
    { op: 'add_relation', relation: { id: 'r2', kind: 'association', source: 'Cliente', target: 'Pedido', label: 'realiza' } },
    { op: 'update_element', id: 'Linea', changes: { name: 'LineaDePedido' } },
  ],
};

export const applyChangesTool = (commands: DiagramCommandService, results: ToolResultFormatter) =>
  defineTool({
    name: 'apply_changes',
    annotations: { title: 'Modificar diagrama', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    description: [
      'Solo para refinar un diagrama que ya existe y del que se está hablando. Si la persona pide un diagrama nuevo o de otro tema, usa create_diagram: apply_changes sobre el diagrama activo lo pisaría.',
      'Modifica un diagrama existente con un lote atómico de 1 a 200 operaciones, aplicadas en orden. Los cambios aparecen en vivo en la app y el resto del diagrama no se mueve.',
      'Operaciones (campo "op"): add_element, update_element {id, changes}, remove_element {id, cascade?: "reparent"|"children"}, add_relation, update_relation {id, changes}, remove_relation {id}, move_element {id, x, y} (fija el elemento), resize_element {id, width, height} (tamaño mínimo elegido a mano), set_title.',
      'update_relation admite además kind (cambiar el tipo de flecha), sourceSide/targetSide ("top"|"right"|"bottom"|"left") y waypoints (puntos de quiebre); para invertir una flecha intercambia source y target. En un connector (flecha libre, válido en cualquier tipo de diagrama) admite arrowheads (none | end | both), dashed y label. En diagramas er también admite sourceCardinality, targetCardinality e identifying, y update_element admite weak, y en un attribute key, multivalued y derived (en una value-list, values reemplaza la lista completa); en una table update_element admite columns (reemplaza la lista completa); en una figure (válida en cualquier tipo de diagrama) update_element admite shape: circle, square, rectangle, triangle, hexagon o cloud.',
      'Un elemento kind "drawing" representa un trazo libre y admite points (2 a 1024 puntos {x,y} locales entre 0 y 5000), strokeColor (#rrggbb) y strokeWidth (0.5 a 16). Puedes reemplazar points, color o grosor con update_element.',
      'Estilo visual (solo si la persona lo pide): update_element y update_relation admiten style {borderColor?, fillColor?, fontColor? ("#rrggbb"), fontFamily? ("sans-serif"|"serif"|"monospace"|"handwritten"), fontSize? (entero de 8 a 48)}. style reemplaza el estilo completo, así que reenvía los campos que quieras conservar; style: null lo elimina. En una relación, borderColor es el color de la línea.',
      'En changes, null elimina un campo opcional; id y kind no se pueden cambiar. Al eliminar un elemento se eliminan también sus relaciones.',
      'Sin diagramId se usa el diagrama activo (la respuesta indica cuál). baseRevision es informativo: si no coincide se aplica igual y se avisa en warnings.',
      'Si alguna operación es inválida no se aplica ninguna y recibes los errores con path (p. ej. /operations/2/id) y hint.',
      `Ejemplo de entrada: ${JSON.stringify(EXAMPLE)}`,
    ].join('\n'),
    input: z.strictObject({
      diagramId: DiagramIdSchema.optional(),
      baseRevision: z.number().int().nonnegative().optional().describe('Revisión sobre la que razonaste los cambios'),
      operations: OperationBatchSchema,
    }),
    output: z.strictObject({
      diagramId: z.string(),
      revision: z.number().int(),
      viewUrl: z.string(),
      applied: z.number().int(),
      warnings: z.array(z.string()),
    }),
    run: async (args) => {
      const { diagram, warnings, applied } = await commands.apply({ ...args, origin: 'agent' });
      const viewUrl = results.viewUrl(diagram.id);
      return {
        linkDiagramId: diagram.id,
        title: diagram.title,
        summary: `${applied} operación(es) aplicadas a "${diagram.title}" (${diagram.id}), ahora en la revisión ${diagram.revision}. Se ve en ${viewUrl}${warnings.length ? `\nAvisos:\n- ${warnings.join('\n- ')}` : ''}`,
        structured: { diagramId: diagram.id, revision: diagram.revision, viewUrl, applied, warnings },
      };
    },
  });
