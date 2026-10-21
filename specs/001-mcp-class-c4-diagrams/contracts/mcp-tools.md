# Contract: herramientas MCP

**Version de esquema**: `1.0.0` (semver, principio VI) | Transportes: Streamable HTTP
`/mcp` y stdio vía puente `chartsia-mcp`. Nombre del servidor: `chartsia`.

Convenciones (research R3):

- Todos los objetos con `additionalProperties: false`; uniones como `anyOf` discriminado por
  `kind`/`op`; sin `oneOf`, sin `$ref` recursivo, sin `format`.
- Cada herramienta lleva en `description` qué hace, cuándo usarla y un ejemplo mínimo de
  entrada (FR-003).
- Éxito: `structuredContent` según el esquema de salida + `content[0]` texto con resumen y
  `viewUrl`. Las herramientas que modifican un diagrama (`create_diagram`, `apply_changes`)
  añaden `content[1]` de tipo `resource_link` a `chartsia://diagrams/{id}/export.svg`, para que
  un agente sin la app abierta pueda ver el resultado renderizado (principio I).
- `viewUrl` = `{CHARTSIA_PUBLIC_URL}/d/{diagramId}`; abre la app en ese diagrama. Lo construye
  el adaptador MCP, no el servicio de dominio.
- Error de dominio: `isError: true`, `structuredContent: { errors: ValidationError[] }`, texto
  con la lista legible. Nunca se aplica nada parcialmente.
- Tipos referenciados (`Element`, `Relation`, `Operation`, `ValidationError`) en
  [data-model.md](../data-model.md).

## `create_diagram`

Crea un diagrama completo a partir de una descripción estructural, lo dispone
automáticamente, lo convierte en diagrama activo y lo muestra en la app. Las coordenadas son
opcionales: un elemento puede traer `layout: { x, y }`, que se respeta como posición fijada
(`pinned: true`); el resto lo coloca el layout automático.

Input:

```json
{
  "type": "class | c4-context | c4-container | c4-component | er",
  "title": "string",
  "elements": ["Element"],
  "relations": ["Relation"],
  "projectId": "string (opcional)"
}
```

Miembros UML: `abstract: true` en una clase dibuja `«abstract»` y el nombre en cursiva; un
método de interfaz con `default: true` se dibuja como `+ default nombre()` (sin cursiva) y solo se
admite en interfaces, sin `abstract` ni `static` (si no, `INVALID_MEMBER`); un `enum` admite
`attributes` y `operations` opcionales además de `literals`.

Diagramas `er` (entidad-relación): solo admiten `entity` (`weak: true` la dibuja con doble
borde, como entidad débil) y relaciones `er-rel` entre entidades. Cada `er-rel` exige
`sourceCardinality` y `targetCardinality` (`one`, `zero-one`, `one-many` o `zero-many`, notación
pata de gallo; cada marca se dibuja en su extremo); si falta alguna, `FIELD_REQUIRED`.
`identifying: true` la dibuja con línea continua y, sin él, discontinua. Estos campos, y las
multiplicidades UML, no se admiten fuera de su tipo (`FIELD_NOT_ALLOWED`); los kinds y
relaciones de `class` y C4 tampoco valen en `er` (`KIND_NOT_ALLOWED`, `RELATION_NOT_ALLOWED`).
`table` es una tabla de base de datos: `columns` (1 a 200, nombres únicos por tabla) con
`name`, `type`, `pk?`, `fk?: {table, column}`, `notNull?` y `unique?`. Se dibuja con una fila
por columna (`PK id: INT NOT NULL`; la PK en negrita y subrayada, la FK en cursiva). Una `fk` debe
apuntar a otra tabla existente y a una de sus columnas `pk`: si no, `UNKNOWN_REFERENCE` o
`INVALID_MEMBER`; una columna repetida es `INVALID_MEMBER`. La flecha FK→PK es una `er-rel`
normal entre las dos tablas, que declara el agente.
`attribute` es un atributo de la notación Chen (óvalo): `key: true` subraya el nombre, `multivalued: true`
lo dibuja con doble óvalo y `derived: true` con borde discontinuo; una clave no puede ser multivaluada
ni derivada (`FIELD_NOT_ALLOWED`). `value-list` es una lista de valores (`values`, 1 a 200, sin repetidos:
`INVALID_MEMBER`) con una fila por valor. Se unen con relaciones `er-attr` (sin cardinalidad), siempre del
dueño a lo que cuelga de él: `entity`→`attribute`, `attribute`→`attribute` (atributo compuesto, con
sub-atributos) o `attribute`→`value-list`; cualquier otro par es `RELATION_NOT_ALLOWED`, igual que un
atributo o lista con dos dueños o un ciclo de atributos. Las `er-rel` solo unen `entity` o `table`.
En `apply_changes`, `update_element` admite `weak`, `columns` (reemplaza la lista), `key`, `multivalued`,
`derived`, `values` (reemplaza la lista) y `update_relation` admite
`sourceCardinality`, `targetCardinality` e `identifying`.

`projectId` coloca el diagrama en un proyecto existente; si no existe, `PROJECT_NOT_FOUND` y no
se crea nada.

Output: `{ diagramId, revision, viewUrl, counts: {elements, relations}, warnings: string[] }`

Ejemplo de descripción para el agente (incluido en `description` de la herramienta):

```json
{"type":"class","title":"Pedidos","elements":[
  {"id":"Pedido","kind":"class","name":"Pedido","attributes":[{"name":"total","type":"Decimal","visibility":"-"}],"operations":[]},
  {"id":"Linea","kind":"class","name":"LineaPedido","attributes":[],"operations":[]}],
 "relations":[{"id":"r1","kind":"composition","source":"Pedido","target":"Linea","targetMultiplicity":"1..*"}]}
```

## `apply_changes`

Aplica un lote atómico de operaciones a un diagrama existente; layout incremental.

Input: `{ diagramId?: string, baseRevision?: integer, operations: Operation[] }`

- `diagramId` omitido → diagrama activo (la respuesta indica cuál).
- `baseRevision` informativo: si difiere, se aplica igual ("último gana") y se añade warning.

Output: `{ diagramId, revision, viewUrl, applied: integer, warnings: string[] }`

## `get_diagram`

Input: `{ diagramId?: string, includeLayout?: boolean (defecto false) }`
Output: `Diagram` (sin `layout`/`route` salvo `includeLayout`), refleja ediciones manuales.

## `list_diagrams`

Input: `{}` → Output: `{ activeDiagramId: string|null, diagrams: [{diagramId, type, title, revision, updatedAt, projectId?}], projects: [{id, name, createdAt}] }`

`projectId` solo aparece si el diagrama pertenece a un proyecto.

## `open_diagram`

Convierte un diagrama existente en el activo y hace que la app navegue a él (evento
`active.changed`). Es el equivalente MCP de `POST /api/diagrams/:id/activate`: ninguna
capacidad existe solo en una superficie (principio I).

Input: `{ diagramId: string }` → Output: `{ diagramId, viewUrl }`

## `create_project`

Crea un proyecto vacío para agrupar diagramas. Solo si la persona lo pide. Equivale a
`POST /api/projects`. Renombrar y borrar proyectos son solo de la app (REST).

Input: `{ name: string (1..100, se recorta) }` → Output: `{ projectId, name }`

## `move_diagram`

Mueve un diagrama a un proyecto existente o lo saca con `null`. Equivale a
`PUT /api/diagrams/:id/project`. Errores: `DIAGRAM_NOT_FOUND`, `PROJECT_NOT_FOUND`.

Input: `{ diagramId: string, projectId: string | null }` → Output: `{ diagramId, projectId }`

## `export_diagram`

Input: `{ diagramId?: string, format: "svg | drawio | excalidraw" }`
Output: `{ diagramId, format, mimeType, filename, downloadUrl, content }`

- `content` es el archivo como texto (todos los formatos son texto). Si excede 512 KiB se omite
  `content` y solo se devuelve `downloadUrl`.
- `downloadUrl` apunta a `GET /api/diagrams/:id/export` y exige la misma autenticación que el
  resto del hub. Fuera de loopback, un agente debe usar `content` o el recurso MCP equivalente.
- También se ofrece como recurso MCP `chartsia://diagrams/{id}/export.{ext}`.

## Recursos MCP

- `chartsia://diagrams/{id}` → JSON del diagrama (mismo que `get_diagram`).
- `chartsia://diagrams/{id}/export.{ext}` → archivo exportado (`svg`, `drawio`, `excalidraw`).
- `chartsia://schema/{type}` → guía breve de kinds y relaciones permitidas por tipo.

## Contract tests obligatorios (principio V)

Escritos antes de implementar cada herramienta. Por herramienta: entrada válida mínima,
entrada válida completa, cada código de error de data-model alcanzable desde esa herramienta
(incluidos `DIAGRAM_NOT_FOUND` y `NO_ACTIVE_DIAGRAM`), `additionalProperties` rechazado,
determinismo (dos `create_diagram` iguales → mismo `layout`). Ejecutados sobre
`InMemoryTransport` y sobre HTTP real, más un smoke por el puente stdio.
