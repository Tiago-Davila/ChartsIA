import { McpError, ErrorCode, type ReadResourceResult, type Resource, type ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import { EXPORT_FORMATS, type ExportFormat } from '@chartsia/core/export';
import {
  ALLOWED_KINDS_BY_DIAGRAM,
  ALLOWED_RELATIONS_BY_DIAGRAM,
  DIAGRAM_TYPES,
  FONT_FAMILIES,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_WIDTHS,
  type DiagramType,
} from '@chartsia/core/model';
import { isDomainValidationError } from '@chartsia/core/validation';
import { type DiagramQueryService } from '../diagrams/diagram-query.service.js';
import { type ExportService } from '../diagrams/export.service.js';

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  { uriTemplate: 'chartsia://diagrams/{id}', name: 'diagram', title: 'Diagrama (JSON)', description: 'Estado del diagrama, igual que get_diagram.', mimeType: 'application/json' },
  { uriTemplate: 'chartsia://diagrams/{id}/export.{ext}', name: 'diagram-export', title: 'Diagrama exportado', description: 'Exportación en svg, drawio o excalidraw.' },
  { uriTemplate: 'chartsia://schema/{type}', name: 'diagram-schema', title: 'Guía por tipo de diagrama', description: 'Kinds, campos y relaciones permitidas para class, c4-context, c4-container, c4-component, er o nosql.', mimeType: 'text/markdown' },
];

const KIND_FIELDS: Record<string, string> = {
  class: 'attributes[] {name, type?, visibility: + - # ~, static?, defaultValue?}, operations[] {name, parameters[] {name, type?}, returnType?, visibility, static?, abstract?}, abstract? (se dibuja «abstract» y el nombre en cursiva), stereotype?',
  interface: 'operations[] (igual que en class; default?: true marca un método default de Java, se dibuja con la palabra default y sin cursiva; solo en interfaces, no con abstract ni static), attributes[]?',
  enum: 'literals[] (≥1, únicos), attributes[]? y operations[]? (como en class)',
  package: 'grupo: otros elementos lo referencian con parentId. Úsalo solo si la persona pide agrupar en paquetes',
  frame: 'marco con título: grupo genérico en cualquier tipo de diagrama; asigna su id a parentId en los elementos que contiene. Admite marcos anidados',
  person: 'external?, description?',
  'software-system': 'external?, description?',
  container: 'technology?, variant?: default | database | queue | web, description?',
  component: 'technology?, description?; parentId de un boundary con boundaryType "container"',
  entity: 'weak?: true (entidad débil, se dibuja con doble borde), description?',
  table: 'columns[] (≥1, máx. 200, nombres únicos) {name, type, pk?, fk?: {table, column}, notNull?, unique?}; una fila por columna ("PK id: INT NOT NULL"; PK en negrita y subrayada, FK en cursiva). fk debe apuntar a una columna pk de otra tabla; la flecha FK→PK la dibujas tú con una er-rel entre las dos tablas',
  collection: 'colección documental: fields[] (máx. 200) contiene rutas planas {path: string[], type}; cada segmento empieza con letra o _, sigue con letras, dígitos, _ o -, máx. 64; path tiene 1–8 segmentos y no permite __proto__, constructor ni prototype. Tipos simples: string | number | boolean | date | timestamp | objectId | reference | geopoint | null. Un campo object puede tener campos hijos cuya ruta lo extienda; array requiere itemsType con un tipo simple u object. Los arrays de subdocumentos (`array<object>`) admiten campos hijos bajo su ruta. Ejemplo: {path:["cliente","direcciones"], type:"array", itemsType:"object"} y {path:["cliente","direcciones","calle"], type:"string"}.',
  figure: 'figura general permitida en TODOS los tipos de diagrama; shape (obligatorio): circle | oval | square | rectangle | triangle | isosceles-triangle | equilateral-triangle | scalene-triangle | right-triangle | diamond | parallelogram | pentagon | hexagon | heptagon | octagon | cloud; name es el texto centrado dentro (triangle equivale a isosceles-triangle; los triángulos prefieren las variantes nuevas). Úsala solo si la persona pide una figura básica o libre (no para sustituir clases, entidades ni elementos C4). En clases y C4 las relaciones del tipo de diagrama valen también entre figuras; para unir figuras entre sí, o una figura con una entity, table o attribute de er, usa la relación connector (en er, er-rel y er-attr no admiten figuras)',
  drawing: 'trazo libre permitido en TODOS los tipos de diagrama; points (obligatorio, 2–1024 puntos locales {x,y} entre 0 y 5000), strokeColor (#rrggbb) y strokeWidth (0.5–16; la app ofrece 1.5 fino, 2.5 medio y 5 grueso); highlighter?: true lo convierte en marcador (trazo ancho, p. ej. strokeWidth 14 y strokeColor #facc15, semitransparente y dibujado detrás de las figuras para resaltar una zona sin tapar el texto; la app ofrece 8 fino, 14 medio y 16 grueso). La app permite seleccionarlo, moverlo y borrarlo; también puedes crearlo con create_diagram o add_element y exportarlo.',
  image: 'imagen PNG/JPG válida o SVG saneado; src es un data URL base64 embebido (máximo 5 MiB por archivo). No se aceptan rutas ni URLs remotas. SVG admite formas y texto pasivos; se rechazan scripts, enlaces, estilos activos y XML externo. El diagrama admite hasta 25 MiB de archivos y 40 millones de píxeles raster en total',
  attribute: 'Notación Chen: óvalo unido a su entidad con una er-attr. key?: true (nombre subrayado; no con multivalued ni derived), multivalued?: true (doble óvalo), derived?: true (óvalo discontinuo). Un atributo compuesto es el que tiene sub-atributos: une cada sub-atributo a él con otra er-attr',
  'value-list': 'values[] (≥1, máx. 200, únicos): lista de valores posibles de un atributo, una fila por valor; se une al atributo con una er-attr (atributo→lista)',
  boundary: 'grupo; boundaryType: enterprise | system | container. Úsalo solo si la persona lo pide o si hace falta para un component',
};

const RELATION_RULES: Record<string, string> = {
  association: 'sourceMultiplicity?, targetMultiplicity?, navigable?: none | source-to-target | both, label?',
  aggregation: 'el rombo vacío va en source (el todo); multiplicidades opcionales',
  composition: 'el rombo lleno va en source (el todo); multiplicidades opcionales',
  inheritance: 'class→class o interface→interface; source es el hijo, target el padre',
  realization: 'class→interface',
  dependency: 'label?',
  'c4-rel': 'label? (qué hace) y technology? (protocolo); solo en diagramas C4',
  'er-attr': 'une un atributo o lista a su dueño; source es el dueño y target lo que cuelga de él: entity→attribute, attribute→attribute (compuesto) o attribute→value-list. Un atributo o lista cuelga de un solo dueño. Sin cardinalidades ni identifying; solo en diagramas er',
  connector: 'flecha o línea libre, sin semántica UML/C4, permitida en TODOS los tipos de diagrama y entre cualquier par de elementos que no sean grupos. Úsala para unir figuras entre sí o con elementos de cualquier tipo, y para uniones libres; si existe una relación propia del tipo (herencia, c4-rel, er-rel, er-attr…) usa esa. arrowheads?: none (sin punta) | end (punta en el destino, por defecto) | both (punta en ambos extremos), dashed?: true (línea discontinua), label?',
  'er-rel': 'sourceCardinality y targetCardinality obligatorias (one | zero-one | one-many | zero-many, pata de gallo; cada marca va en su extremo), identifying?: true (línea continua; sin él es discontinua), label?; solo une entities o tables, y solo en diagramas er',
  'nosql-rel': 'flecha de referencia entre dos colecciones; source es la colección que guarda la referencia y target la colección referenciada; label? puede indicar el campo de referencia',
};

export function schemaGuide(type: DiagramType): string {
  const kinds = ALLOWED_KINDS_BY_DIAGRAM[type].map((k) => `- \`${k}\`: ${KIND_FIELDS[k]}`).join('\n');
  const relations = ALLOWED_RELATIONS_BY_DIAGRAM[type].map((k) => `- \`${k}\`: ${RELATION_RULES[k]}`).join('\n');
  return [
    `# Diagrama \`${type}\``,
    '',
    'Todos los elementos: `id` (letra inicial; letras, dígitos, "_" o "-"; máx. 64), `kind`, `name` (1–200), `description?` (≤1000), `parentId?` (grupo contenedor: package, boundary o frame), `layout?` ({x, y} solo para fijar), `style?` (ver "Estilo").',
    '',
    '## Kinds permitidos',
    kinds,
    '',
    '## Relaciones permitidas',
    'Todas: `id`, `kind`, `source`, `target` (ids de elementos que no sean grupos), `label?` (≤200).',
    relations,
    '',
    '## Estilo',
    `Opcional en elementos y relaciones, solo si la persona lo pide: \`style\` {\`borderColor?\`, \`fillColor?\`, \`fontColor?\` (\`#rrggbb\`), \`lineWidth?\` (${LINE_WIDTHS.join(' | ')}: grosor del borde o de la línea), \`fontFamily?\` (${FONT_FAMILIES.join(' | ')}), \`fontSize?\` (entero de ${FONT_SIZE_MIN} a ${FONT_SIZE_MAX})}. En una relación, \`borderColor\` es el color de la línea. En \`update_element\` y \`update_relation\`, \`style\` reemplaza el estilo completo y \`null\` lo elimina.`,
  ].join('\n');
}

const EXT_PATTERN = new RegExp(`^chartsia://diagrams/([^/]+)/export\\.(${EXPORT_FORMATS.join('|')})$`);

export async function listResources(query: DiagramQueryService): Promise<Resource[]> {
  const { diagrams } = await query.list();
  return [
    ...diagrams.map((d) => ({ uri: `chartsia://diagrams/${d.diagramId}`, name: d.diagramId, title: d.title, mimeType: 'application/json' })),
    ...DIAGRAM_TYPES.map((t) => ({ uri: `chartsia://schema/${t}`, name: `schema-${t}`, title: `Guía: ${t}`, mimeType: 'text/markdown' })),
  ];
}

export async function readResource(uri: string, query: DiagramQueryService, exports: ExportService): Promise<ReadResourceResult> {
  try {
    const schema = /^chartsia:\/\/schema\/([a-z0-9-]+)$/.exec(uri);
    if (schema && (DIAGRAM_TYPES as readonly string[]).includes(schema[1]!)) {
      return { contents: [{ uri, mimeType: 'text/markdown', text: schemaGuide(schema[1] as DiagramType) }] };
    }
    const exported = EXT_PATTERN.exec(uri);
    if (exported) {
      const out = await exports.export({ diagramId: decodeURIComponent(exported[1]!), format: exported[2] as ExportFormat });
      return { contents: [{ uri, mimeType: out.mimeType, text: out.content }] };
    }
    const diagram = /^chartsia:\/\/diagrams\/([^/]+)$/.exec(uri);
    if (diagram) {
      const d = await query.get(decodeURIComponent(diagram[1]!));
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(d) }] };
    }
  } catch (error) {
    if (isDomainValidationError(error)) throw new McpError(ErrorCode.InvalidParams, error.errors.map((e) => e.message).join(' '));
    throw error;
  }
  throw new McpError(ErrorCode.InvalidParams, `Recurso desconocido: ${uri}`);
}
