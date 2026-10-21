import { McpError, ErrorCode, type ReadResourceResult, type Resource, type ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';
import { EXPORT_FORMATS, type ExportFormat } from '@chartsia/core/export';
import {
  ALLOWED_KINDS_BY_DIAGRAM,
  ALLOWED_RELATIONS_BY_DIAGRAM,
  DIAGRAM_TYPES,
  type DiagramType,
} from '@chartsia/core/model';
import { isDomainValidationError } from '@chartsia/core/validation';
import { type DiagramQueryService } from '../diagrams/diagram-query.service.js';
import { type ExportService } from '../diagrams/export.service.js';

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  { uriTemplate: 'chartsia://diagrams/{id}', name: 'diagram', title: 'Diagrama (JSON)', description: 'Estado del diagrama, igual que get_diagram.', mimeType: 'application/json' },
  { uriTemplate: 'chartsia://diagrams/{id}/export.{ext}', name: 'diagram-export', title: 'Diagrama exportado', description: 'Exportación en svg, drawio o excalidraw.' },
  { uriTemplate: 'chartsia://schema/{type}', name: 'diagram-schema', title: 'Guía por tipo de diagrama', description: 'Kinds, campos y relaciones permitidas para class, c4-context, c4-container, c4-component o er.', mimeType: 'text/markdown' },
];

const KIND_FIELDS: Record<string, string> = {
  class: 'attributes[] {name, type?, visibility: + - # ~, static?, defaultValue?}, operations[] {name, parameters[] {name, type?}, returnType?, visibility, static?, abstract?}, abstract? (se dibuja «abstract» y el nombre en cursiva), stereotype?',
  interface: 'operations[] (igual que en class; default?: true marca un método default de Java, se dibuja con la palabra default y sin cursiva; solo en interfaces, no con abstract ni static), attributes[]?',
  enum: 'literals[] (≥1, únicos), attributes[]? y operations[]? (como en class)',
  package: 'grupo: otros elementos lo referencian con parentId. Úsalo solo si la persona pide agrupar en paquetes',
  person: 'external?, description?',
  'software-system': 'external?, description?',
  container: 'technology?, variant?: default | database | queue | web, description?',
  component: 'technology?, description?; parentId de un boundary con boundaryType "container"',
  entity: 'weak?: true (entidad débil, se dibuja con doble borde), description?',
  table: 'columns[] (≥1, máx. 200, nombres únicos) {name, type, pk?, fk?: {table, column}, notNull?, unique?}; una fila por columna ("PK id: INT NOT NULL"; PK en negrita y subrayada, FK en cursiva). fk debe apuntar a una columna pk de otra tabla; la flecha FK→PK la dibujas tú con una er-rel entre las dos tablas',
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
  'er-rel': 'sourceCardinality y targetCardinality obligatorias (one | zero-one | one-many | zero-many, pata de gallo; cada marca va en su extremo), identifying?: true (línea continua; sin él es discontinua), label?; solo une entities o tables, y solo en diagramas er',
};

export function schemaGuide(type: DiagramType): string {
  const kinds = ALLOWED_KINDS_BY_DIAGRAM[type].map((k) => `- \`${k}\`: ${KIND_FIELDS[k]}`).join('\n');
  const relations = ALLOWED_RELATIONS_BY_DIAGRAM[type].map((k) => `- \`${k}\`: ${RELATION_RULES[k]}`).join('\n');
  return [
    `# Diagrama \`${type}\``,
    '',
    'Todos los elementos: `id` (letra inicial; letras, dígitos, "_" o "-"; máx. 64), `kind`, `name` (1–200), `description?` (≤1000), `parentId?` (grupo contenedor), `layout?` ({x, y} solo para fijar).',
    '',
    '## Kinds permitidos',
    kinds,
    '',
    '## Relaciones permitidas',
    'Todas: `id`, `kind`, `source`, `target` (ids de elementos que no sean grupos), `label?` (≤200).',
    relations,
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
