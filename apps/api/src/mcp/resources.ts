import { McpError, ErrorCode, type ReadResourceResult, type Resource, type ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import { EXPORT_FORMATS, type ExportFormat } from '@chartsia/core/export';
import {
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
  { uriTemplate: 'chartsia://schema/{type}', name: 'diagram-schema', title: 'Guía por tipo de diagrama', description: 'Kinds, campos y relaciones permitidas para class, c4-context, c4-container, c4-component, er o nosql. Son las mismas en todos los tipos: el tipo no restringe nada.', mimeType: 'text/markdown' },
];

const KIND_FIELDS: Record<string, string> = {
  class: 'attributes[] {name, type?, visibility: + - # ~, static?, defaultValue?}, operations[] {name, parameters[] {name, type?}, returnType?, visibility, static?, abstract?}, abstract? (se dibuja «abstract» y el nombre en cursiva), stereotype?',
  interface: 'operations[] (igual que en class; default?: true marca un método default de Java, se dibuja con la palabra default y sin cursiva; solo en interfaces, no con abstract ni static), attributes[]?',
  enum: 'literals[] (≥1, únicos), attributes[]? y operations[]? (como en class)',
  package: 'grupo: otros elementos lo referencian con parentId. Úsalo solo si la persona pide agrupar en paquetes',
  frame: 'marco con título: grupo genérico, válido en cualquier diagrama; asigna su id a parentId en los elementos que contiene. Admite marcos anidados',
  person: 'external?, description?',
  'software-system': 'external?, description?',
  container: 'technology?, variant?: default | database | queue | web, description?',
  component: 'technology?, description?; parentId obligatorio: un boundary con boundaryType "container", directamente o mediante un frame',
  entity: 'weak?: true (entidad débil, se dibuja con doble borde), associative?: true (entidad asociativa, borde discontinuo), description?',
  table: 'columns[] (≥1, máx. 200, nombres únicos) {name, type, pk?, fk?: {table, column}, notNull?, unique?}; una fila por columna ("PK id: INT NOT NULL"; PK en negrita y subrayada, FK en cursiva). fk debe apuntar a una columna pk de otra tabla; la flecha FK→PK la dibujas tú con una er-rel entre las dos tablas',
  collection: 'colección documental: fields[] (máx. 200) contiene rutas planas {path: string[], type}; cada segmento empieza con letra o _, sigue con letras, dígitos, _ o -, máx. 64; path tiene 1–8 segmentos y no permite __proto__, constructor ni prototype. Tipos simples: string | number | boolean | date | timestamp | objectId | reference | geopoint | null. Un campo object puede tener campos hijos cuya ruta lo extienda; array requiere itemsType con un tipo simple u object. Los arrays de subdocumentos (`array<object>`) admiten campos hijos bajo su ruta. Ejemplo: {path:["cliente","direcciones"], type:"array", itemsType:"object"} y {path:["cliente","direcciones","calle"], type:"string"}.',
  figure: 'figura general, válida en cualquier diagrama; shape (obligatorio): circle | oval | square | rectangle | triangle | isosceles-triangle | equilateral-triangle | scalene-triangle | right-triangle | diamond | parallelogram | pentagon | hexagon | heptagon | octagon | cloud | arrow | double-arrow | arrow-right | arrow-left | arrow-up | arrow-down; name es el texto centrado dentro (triangle equivale a isosceles-triangle; los triángulos prefieren las variantes nuevas). arrow es una flecha simple, double-arrow una flecha doble y arrow-right, arrow-left, arrow-up y arrow-down flechas de bloque (apuntan a su lado). Las flechas son figuras, no relaciones: para unir elementos usa connector. Úsala solo si la persona pide una figura básica o libre (no para sustituir clases, entidades ni elementos C4). En clases y C4 las relaciones propias (association, dependency, c4-rel…) también unen figuras; en er y nosql las figuras solo se unen con connector, que une figuras con cualquier elemento',
  drawing: 'trazo libre válido en cualquier diagrama; points (obligatorio, 2–1024 puntos locales {x,y} entre 0 y 5000), strokeColor (#rrggbb) y strokeWidth (0.5–16; la app ofrece 1.5 fino, 2.5 medio y 5 grueso); highlighter?: true lo convierte en marcador (trazo ancho, p. ej. strokeWidth 14 y strokeColor #facc15, semitransparente y dibujado detrás de las figuras para resaltar una zona sin tapar el texto; la app ofrece 8 fino, 14 medio y 16 grueso). La app permite seleccionarlo, moverlo y borrarlo; también puedes crearlo con create_diagram o add_element y exportarlo.',
  image: 'imagen PNG/JPG válida o SVG saneado, válida en cualquier diagrama; src es un data URL base64 embebido (máximo 5 MiB por archivo). No se aceptan rutas ni URLs remotas. SVG admite formas y texto pasivos; se rechazan scripts, enlaces, estilos activos y XML externo. El diagrama admite hasta 25 MiB de archivos y 40 millones de píxeles raster en total',
  attribute: 'Notación Chen: óvalo unido a su entidad con una er-attr. key?: true (nombre subrayado; no con multivalued, derived ni partialKey), partialKey?: true (clave parcial: subrayado discontinuo; no con key, multivalued ni derived), multivalued?: true (doble óvalo), derived?: true (óvalo discontinuo). Un atributo compuesto es el que tiene sub-atributos: une cada sub-atributo a él con otra er-attr',
  relationship: 'rombo de relación Chen con name dentro; identifying?: true (doble borde: relación identificante). Une entidades con connector (no con er-rel ni er-attr); pon la cardinalidad como label del conector (1, N, M) y la participación total con sourceTotal/targetTotal',
  specialization: 'triángulo de especialización o generalización: overlapping?: true (subclases solapadas, letra o; sin él, disjuntas, letra d). Une la superclase y cada subclase con connector sin puntas; name va debajo del triángulo',
  'value-list': 'values[] (≥1, máx. 200, únicos): lista de valores posibles de un atributo, una fila por valor; se une al atributo con una er-attr (atributo→lista)',
  boundary: 'grupo; boundaryType: enterprise | system | container. Úsalo solo si la persona lo pide o si hace falta para un component',
};

const RELATION_RULES: Record<string, string> = {
  association: 'entre elementos de clases (class, interface, enum); sourceMultiplicity?, targetMultiplicity?, navigable?: none | source-to-target | both, label?',
  aggregation: 'entre elementos de clases; el rombo vacío va en source (el todo); multiplicidades opcionales',
  composition: 'entre elementos de clases; el rombo lleno va en source (el todo); multiplicidades opcionales',
  inheritance: 'class→class o interface→interface; source es el hijo, target el padre',
  realization: 'class→interface',
  dependency: 'entre elementos de clases; label?',
  'c4-rel': 'label? (qué hace) y technology? (protocolo); une solo elementos C4 (person, software-system, container, component)',
  'er-attr': 'une un atributo o lista a su dueño; source es el dueño y target lo que cuelga de él: entity→attribute, attribute→attribute (compuesto) o attribute→value-list. Un atributo o lista cuelga de un solo dueño. Sin cardinalidades ni identifying; une solo elementos ER (entity, attribute, value-list)',
  connector: 'flecha o línea libre, sin semántica UML/C4, válida en cualquier diagrama y entre cualquier par de elementos que no sean grupos, aunque sean de familias distintas. Úsala para unir figuras entre sí o con elementos de cualquier tipo, y para uniones libres; si existe una relación propia del tipo (herencia, c4-rel, er-rel, er-attr…) usa esa. arrowheads?: none (sin punta) | end (punta en el destino, por defecto) | both (punta en ambos extremos), dashed?: true (línea discontinua), label?, sourceTotal?/targetTotal?: true (participación total: línea doble junto a ese extremo; pensada para unir un rombo ER con sus entidades)',
  'er-rel': 'sourceCardinality y targetCardinality obligatorias (one | zero-one | one-many | zero-many, pata de gallo; cada marca va en su extremo), identifying?: true (línea continua; sin él es discontinua), sourceTotal?/targetTotal?: true (participación total: línea doble junto a ese extremo), label?; solo une entities o tables',
  'nosql-rel': 'flecha de referencia entre dos colecciones; source es la colección que guarda la referencia y target la colección referenciada; label? puede indicar el campo de referencia',
};

/** Guía de kinds y relaciones; son las mismas en todos los tipos de diagrama, que solo indican el uso previsto. */
export function schemaGuide(type: DiagramType): string {
  const kinds = Object.entries(KIND_FIELDS).map(([k, text]) => `- \`${k}\`: ${text}`).join('\n');
  const relations = Object.entries(RELATION_RULES).map(([k, text]) => `- \`${k}\`: ${text}`).join('\n');
  return [
    `# Diagrama \`${type}\``,
    '',
    'Todos los kinds y relaciones valen en cualquier tipo de diagrama, y pueden mezclarse en el mismo diagrama. El tipo es solo una etiqueta de uso y no restringe nada.',
    '',
    'Todos los elementos: `id` (letra inicial; letras, dígitos, "_" o "-"; máx. 64), `kind`, `name` (1–200), `description?` (≤1000), `parentId?` (grupo contenedor: package, boundary o frame), `layout?` ({x, y} solo para fijar), `style?` (ver "Estilo").',
    '',
    '## Kinds',
    kinds,
    '',
    '## Relaciones',
    'Todas: `id`, `kind`, `source`, `target` (ids de elementos que no sean grupos), `label?` (≤200). Cada relación une elementos de su familia (ver abajo); connector une cualquier par de elementos que no sean grupos, de familias distintas incluidas.',
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
