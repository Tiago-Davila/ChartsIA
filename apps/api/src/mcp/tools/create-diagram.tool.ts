import { z } from 'zod';
import { DiagramInputSchema } from '@chartsia/core/model';
import { type DiagramCommandService } from '../../diagrams/diagram-command.service.js';
import { type ToolResultFormatter } from '../tool-result.js';
import { ProjectIdSchema } from './schemas.js';
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
      'Crea un diagrama de clases UML, C4 (contexto, contenedores o componentes) o entidad-relación (er) a partir de una descripción estructural y lo muestra en la app de ChartsIA, donde la persona lo ve al instante.',
      'Úsalo siempre que la persona pida un diagrama nuevo o distinto de los que ya existen (otro tema, sistema o tipo): crea un diagrama aparte y no modifica los anteriores. No uses apply_changes para eso.',
      'No envíes coordenadas: el servidor dispone el diagrama automáticamente sin solapes. Solo si quieres fijar un elemento, añade layout {"x","y"}.',
      'Cada elemento y relación lleva un id estable elegido por ti (letra inicial, letras, dígitos, "_" o "-"); úsalo después en apply_changes.',
      'Kinds: class → class, interface, enum, package (grupo). c4-context → person, software-system, boundary. c4-container → además container (variant: default|database|queue|web). c4-component → además component, que debe ir dentro de un boundary con boundaryType "container". er → entity (weak:true para entidad débil, doble borde) y table (columns[] con name, type, pk?, fk? {table, column}, notNull?, unique?; fk debe apuntar a una columna pk de otra tabla), attribute (óvalo de la notación Chen: key? subrayado, multivalued? doble óvalo, derived? discontinuo) y value-list (values[]: lista de valores de un atributo). frame es un grupo universal con título en name; parentId contiene elementos dentro del marco y permite marcos anidados.',
      'Figuras generales: en CUALQUIER tipo de diagrama puedes usar kind "figure" con shape (circle, square, rectangle, triangle, hexagon o cloud); name es el texto centrado dentro. Úsalas solo si la persona pide figuras básicas o libres.',
      'Lápiz: en cualquier diagrama puedes enviar un elemento kind "drawing" con name, points (2 a 1024 puntos {x,y} locales, ambos entre 0 y 5000), strokeColor (#rrggbb) y strokeWidth (0.5 a 16). La app normaliza los trazos del puntero; para MCP, pon layout {x,y} en la posición del trazo.',
      'Imágenes: en cualquier tipo de diagrama puedes usar kind "image" con src como data URL base64 PNG/JPG o SVG saneado (máx. 5 MiB por archivo). El hub valida el contenido y lo persiste embebido; no acepta rutas ni URLs remotas. El total por diagrama es 25 MiB y 40 millones de píxeles raster; el cuerpo HTTP por defecto admite 8 MiB.',
      'Miembros: una clase abstract:true se dibuja con «abstract»; un método de interface con default:true se dibuja como método default de Java (solo en interfaces); un enum admite attributes y operations además de literals.',
      'No agrupes por tu cuenta: usa package, boundary o frame solo si la persona pide agrupar, y boundary también si el tipo lo exige (component dentro de su container).',
      'Relaciones UML: association, aggregation, composition (el rombo va en source), inheritance (class→class o interface→interface), realization (class→interface), dependency. En C4 usa solo c4-rel con label y technology. En er usa solo er-rel entre entities o tables (para una FK, dibuja además la er-rel de la tabla con la FK a la tabla con la PK), con sourceCardinality y targetCardinality obligatorias (one, zero-one, one-many, zero-many; notación pata de gallo, cada marca va en su extremo) e identifying:true si es identificante (línea continua; si no, discontinua). Los atributos y listas se unen con er-attr (sin cardinalidad), siempre del dueño a lo que cuelga de él: entity→attribute, attribute→attribute (atributo compuesto con sub-atributos) o attribute→value-list; un atributo o lista cuelga de un solo dueño. Para flechas y uniones libres (por ejemplo entre figuras, o entre una figura y una entity, table o attribute) existe connector en todos los tipos de diagrama: arrowheads (none | end | both), dashed y label; no lo uses si existe una relación propia del tipo.',
      'Estilo (opcional, solo si la persona lo pide): cada elemento y relación admite style {borderColor?, fillColor?, fontColor? ("#rrggbb"), fontFamily? ("sans-serif"|"serif"|"monospace"|"handwritten"), fontSize? (entero de 8 a 48)}.',
      'projectId (opcional) coloca el diagrama en un proyecto existente; úsalo solo si la persona lo pidió.',
      'Si algo es inválido no se crea nada y recibes errores con code, path (JSON Pointer), message y hint para corregirlos. La guía completa por tipo está en el recurso chartsia://schema/{type}.',
      `Ejemplo de entrada: ${JSON.stringify(EXAMPLE)}`,
    ].join('\n'),
    input: DiagramInputSchema.extend({ projectId: ProjectIdSchema.optional() }),
    output: z.strictObject({
      diagramId: z.string(),
      revision: z.number().int(),
      viewUrl: z.string(),
      counts: z.strictObject({ elements: z.number().int(), relations: z.number().int() }),
      warnings: z.array(z.string()),
    }),
    run: async (args) => {
      const { projectId, ...input } = args;
      const { diagram, warnings } = await commands.create(input, projectId);
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
