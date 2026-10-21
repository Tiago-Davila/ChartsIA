# Data Model: Diagramas de clases y C4

**Feature**: `001-mcp-class-c4-diagrams` | **Date**: 2026-10-19

El modelo canónico vive en `packages/core/src/model` y se define con esquemas Zod de los que
derivan tipos TS y JSON Schema (contratos MCP). No contiene estilos de ningún formato externo.

## Diagram

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | string | `dg_` + 12 chars base32; generado por el núcleo (`model/ids.ts`) |
| `type` | enum | `class` \| `c4-context` \| `c4-container` \| `c4-component` |
| `title` | string | 1–120 chars |
| `elements` | Element[] | ids únicos en el diagrama (espacio compartido con relaciones); máx. `CHARTSIA_MAX_ELEMENTS` (500) contando grupos |
| `relations` | Relation[] | ids únicos (no pueden coincidir con un id de elemento); `source`/`target` existentes |
| `revision` | integer | +1 por cada lote de operaciones aplicado |
| `createdAt` / `updatedAt` | ISO string | servidor |

## Element (unión discriminada por `kind`)

Campos comunes:

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | string | provisto por el agente; `^[A-Za-z][A-Za-z0-9_-]{0,63}$`; estable |
| `kind` | enum | ver tablas por tipo de diagrama |
| `name` | string | 1–200 chars, texto literal |
| `description` | string? | ≤ 1000 chars |
| `parentId` | string? | id de un grupo (`package`/`boundary`) del mismo diagrama |
| `layout` | Layout? | lo rellena el servidor; en la entrada el agente puede enviar `{ x, y }` |

`Layout`: `{ x, y, width, height, pinned: boolean }`. `pinned=true` cuando la persona movió el
elemento a mano (`move_element`) o el agente envió coordenadas (`layout: { x, y }` en
`add_element` o `create_diagram`; `width`/`height` siempre los calcula el servidor). Ningún
layout, completo ni incremental, mueve un elemento `pinned`.

Reglas de layout incremental (FR-020, research R7): los elementos nuevos se colocan con ELK;
los existentes no fijados conservan su posición salvo que haga falta moverlos para eliminar un
solape; los `pinned` nunca se mueven. Las aristas no deben atravesar elementos que no sean su
origen, destino o grupo contenedor (FR-018).

### Diagrama de clases (`type: class`)

| `kind` | Campos extra |
|--------|--------------|
| `class` | `abstract?: boolean`, `attributes: Attribute[]`, `operations: Operation[]`, `stereotype?` |
| `interface` | `operations: Operation[]`, `attributes?: Attribute[]` |
| `enum` | `literals: string[]` (≥1, únicos) |
| `package` | grupo; sin miembros |

- `Attribute`: `{ name, type?, visibility: "+"|"-"|"#"|"~", static?: bool, defaultValue? }`
- `Operation`: `{ name, parameters: {name, type?}[], returnType?, visibility, static?, abstract? }`

### Diagramas C4

| `kind` | Permitido en | Campos extra |
|--------|--------------|--------------|
| `person` | context, container, component | `external?: boolean` |
| `software-system` | context, container, component | `external?: boolean` |
| `container` | container, component | `technology?`, `variant?: "default"\|"database"\|"queue"\|"web"` |
| `component` | component | `technology?` |
| `boundary` | todos los C4 | grupo; `boundaryType: "enterprise"\|"system"\|"container"` |

## Relation

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | string | mismo patrón que Element.id |
| `kind` | enum | clases: `association`, `aggregation`, `composition`, `inheritance`, `realization`, `dependency`; C4: `c4-rel` |
| `source` / `target` | string | ids de elementos no-grupo existentes |
| `label` | string? | ≤ 200 |
| `sourceMultiplicity` / `targetMultiplicity` | string? | solo `association`/`aggregation`/`composition`; patrón `^(\d+|\*)(\.\.(\d+|\*))?$` |
| `navigable` | enum? | `none` \| `source-to-target` \| `both` (solo `association`) |
| `technology` | string? | solo `c4-rel` |
| `route` | `{x,y}[]`? | lo rellena el servidor (puntos de ELK) |

## Reglas de validación de dominio (códigos estables)

| Código | Regla |
|--------|-------|
| `DUPLICATE_ID` | un único espacio de ids por diagrama: ningún id se repite entre elementos y relaciones |
| `UNKNOWN_REFERENCE` | `source`, `target`, `parentId` deben existir |
| `KIND_NOT_ALLOWED` | el `kind` debe ser válido para el `type` del diagrama (p. ej. `component` solo en `c4-component`) |
| `RELATION_NOT_ALLOWED` | `inheritance`: class→class o interface→interface; `realization`: class→interface; relaciones UML prohibidas en C4 y `c4-rel` prohibida en clases; nada hacia/desde grupos |
| `INHERITANCE_CYCLE` | sin ciclos de herencia |
| `INVALID_PARENT` | `parentId` debe ser un grupo; `package` solo contiene elementos de clases; en `c4-component` un `component` debe estar dentro de un `boundary` de tipo `container` |
| `PARENT_CYCLE` | sin ciclos de anidamiento |
| `FIELD_NOT_ALLOWED` | p. ej. multiplicidad en `inheritance`, `technology` en relación UML |
| `LIMIT_EXCEEDED` | elementos > máximo o petición > `CHARTSIA_MAX_REQUEST_BYTES` (1 MiB) |
| `SCHEMA_VIOLATION` | cualquier error estructural de esquema (incluye lote vacío o > 200 operaciones); el `path` apunta al campo del error de Zod |
| `DIAGRAM_NOT_FOUND` / `NO_ACTIVE_DIAGRAM` | diagrama inexistente o sin diagrama activo |
| `PROJECT_NOT_FOUND` | proyecto inexistente (o id con formato inválido) |

Cada error: `{ code, path (JSON Pointer), message, hint }`. Un lote con algún error se
rechaza completo (FR-017).

## Operations (edición incremental)

Lote atómico `operations: Operation[]` (1–200 por llamada), aplicado en orden:

| `op` | Payload |
|------|---------|
| `add_element` | `element` (puede incluir `layout: { x, y }` ⇒ `pinned`) |
| `update_element` | `id`, `changes` (parcial, sin `id`/`kind`) |
| `remove_element` | `id` (elimina en cascada relaciones; si es grupo, `cascade: "children"\|"reparent"` por defecto `reparent`). Con `reparent`, los hijos pasan al padre del grupo y se revalidan: si alguno queda en un padre no permitido (p. ej. un `component` fuera de un `boundary` container), el lote se rechaza con `INVALID_PARENT` y el hint sugiere `cascade: "children"` |
| `add_relation` | `relation` |
| `update_relation` | `id`, `changes` |
| `remove_relation` | `id` |
| `move_element` | `id`, `x`, `y` (marca `pinned=true`; usado por la app) |
| `set_title` | valor (validado con las mismas reglas que `title`) |

## Estado y transiciones

```text
(petición) --validar--> rechazada (errores, sin cambios)
           \--> aplicada -> layout (completo en create, incremental en ops)
                         -> revision+1 -> persistida -> evento diagram.updated
```

Diagrama activo: el último creado, abierto en la app (`POST /api/diagrams/:id/activate`) o
abierto por un agente (`open_diagram`); lo usan las herramientas cuando se omite `diagramId`.
Se guarda en `index.json`; si el índice se reconstruye, el activo pasa a ser el diagrama con
`updatedAt` más reciente.
