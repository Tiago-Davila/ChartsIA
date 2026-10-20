---

description: "Task list for 001-mcp-class-c4-diagrams"
---

# Tasks: Diagramas de clases y C4 generados por agentes vía MCP

**Input**: Design documents from `specs/001-mcp-class-c4-diagrams/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/mcp-tools.md](./contracts/mcp-tools.md),
[contracts/app-api.md](./contracts/app-api.md), [quickstart.md](./quickstart.md)

**Tests**: Requeridos (constitución, principio V: Test-First). Los tests de reglas de negocio
se escriben antes que su implementación y DEBEN fallar primero.

**Organization**: por fases técnicas, según lo pedido (backend primero, luego frontend). Las
tareas que sirven a una historia concreta llevan su etiqueta `[USx]`; las transversales no la
llevan. "Persistencia de tareas" (fase 3) se interpreta como **persistencia de diagramas**.

## Format: `- [ ] T### [P?] [US?] Descripción — archivos (dep: …)`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes).
- **[USx]**: US1 clases vía agente (P1), US2 C4 (P2), US3 refinar conversando (P2),
  US4 lienzo y edición manual (P3), US5 exportar (P3).
- `dep:` lista las tareas que deben estar completas antes.
- **IDs**: T001–T147 son los originales; T148–T167 se añadieron tras `/speckit-analyze`
  (divisiones de tareas y huecos de cobertura) y están insertadas en su fase. El orden de
  ejecución lo fijan las dependencias, no el número.

## Path Conventions

- Núcleo de dominio: `packages/core/src/`, `packages/core/test/`
- Backend (hub Nest.js): `apps/api/src/`, `apps/api/test/`
- Frontend (React + React Flow): `apps/web/src/`, `apps/web/test/`

---

# BACKEND

## Phase 1: Setup del backend

**Purpose**: monorepo, núcleo y hub Nest compilando y con tests ejecutables (sin lógica).

- [X] T001 Crear monorepo pnpm: `package.json` raíz (private, `engines.node: ">=24"`, scripts `dev`, `build`, `test`, `typecheck`, `lint`), `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `.nvmrc` con `24` — `package.json`, `pnpm-workspace.yaml`, `.nvmrc`
- [X] T002 Crear `tsconfig.base.json` con `strict: true`, `noUncheckedIndexedAccess`, `module/moduleResolution: NodeNext`, `target: ES2023` — `tsconfig.base.json` (dep: T001)
- [X] T003 [P] Configurar ESLint (flat config, typescript-eslint) y Prettier — `eslint.config.js`, `.prettierrc`, `.prettierignore` (dep: T001)
- [X] T004 [P] Actualizar `.gitignore` (node_modules, dist, coverage, `.chartsia/`, `playwright-report/`) — `.gitignore` (dep: T001)
- [X] T005 Crear paquete `@chartsia/core` con deps `zod@^4.6`, `elkjs@^0.12`, `roughjs@^4.6`; scripts `build`, `test`, `test:golden`; exports ESM con subpaths — `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts` (dep: T002)
- [X] T006 Crear paquete `@chartsia/api` (Nest 12: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/platform-socket.io`, `@nestjs/websockets`, `@modelcontextprotocol/sdk@^1.32`, `zod@^4.6`, dependencia `@chartsia/core: workspace:*`), scripts `build`, `start`, `test`; `bin.chartsia-mcp` → `dist/stdio-bridge.js` — `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json` (dep: T002, T005)
- [X] T007 [P] Configurar Vitest para Nest con `unplugin-swc` (metadatos de decoradores) — `apps/api/vitest.config.ts` (dep: T006)
- [X] T008 [P] Implementar configuración tipada desde env: `CHARTSIA_PORT` (defecto 3333), `CHARTSIA_HOST` (defecto `127.0.0.1`), `CHARTSIA_TOKEN`, `CHARTSIA_DATA_DIR` (defecto `~/.chartsia/diagrams`), `CHARTSIA_MAX_ELEMENTS` (defecto 500), `CHARTSIA_MAX_REQUEST_BYTES` (defecto 1 MiB), `CHARTSIA_PUBLIC_URL` para `viewUrl` (defecto `http://<host>:<port>`), `CHARTSIA_WEB_ORIGIN` para CORS (defecto `http://127.0.0.1:5173` en desarrollo); helper `isLoopback(host)` — `apps/api/src/config/config.ts`, `apps/api/src/config/config.module.ts` (dep: T006)
- [X] T009 [P] Logger estructurado JSON que redacta el header `Authorization`, el campo `auth.token` del handshake y no registra cuerpos de diagramas por defecto — `apps/api/src/common/logger.ts` (dep: T006)
- [X] T010 Bootstrap del hub: `AppModule` vacío con `ConfigModule`, `main.ts` escuchando en `CHARTSIA_HOST:CHARTSIA_PORT`, límite de body `CHARTSIA_MAX_REQUEST_BYTES`, CORS solo para `CHARTSIA_WEB_ORIGIN` — `apps/api/src/main.ts`, `apps/api/src/app.module.ts` (dep: T008, T009)
- [X] T148 `HealthController`: `GET /api/health` → `{ status: "ok", version }`, sin auth — `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.module.ts` (dep: T010)
- [X] T011 [P] Crear `THIRD_PARTY_NOTICES.md` con atribución a draw.io (Apache-2.0), Excalidraw (MIT), roughjs (MIT), elkjs (EPL-2.0), Excalifont (OFL-1.1) e Inter (OFL-1.1) — `THIRD_PARTY_NOTICES.md` (dep: T001)

**Checkpoint**: `pnpm typecheck` y `pnpm test` pasan sin tests; `GET /api/health` responde.

---

## Phase 2: Modelo de dominio y enums (`packages/core`)

**Purpose**: modelo canónico y reglas de negocio con sus tests primero (principios II y IV).
**⚠️ CRITICAL**: bloquea todas las fases siguientes.

### Tests de reglas de negocio (escribir primero, deben fallar)

- [ ] T012 [P] Tests de esquemas: id de elemento/relación `^[A-Za-z][A-Za-z0-9_-]{0,63}$`; `name` "1–200 chars"; `description` "≤ 1000 chars"; `title` "1–120 chars"; `label` "≤ 200"; multiplicidad `^(\d+|\*)(\.\.(\d+|\*))?$`; `enum.literals` "≥1, únicos"; `additionalProperties` rechazado — `packages/core/test/unit/model/schemas.test.ts` (dep: T005)
- [ ] T013 [P] Tests de `DUPLICATE_ID` (un único espacio de ids por diagrama: un elemento y una relación no pueden compartir id) y `UNKNOWN_REFERENCE` (`source`, `target`, `parentId` inexistentes) — `packages/core/test/unit/validation/references.test.ts` (dep: T005)
- [ ] T014 [P] Tests de `KIND_NOT_ALLOWED`: `class/interface/enum/package` solo en `class`; `person`, `software-system` en los tres C4; `container` solo en `c4-container` y `c4-component`; `component` solo en `c4-component`; `boundary` en todos los C4 — `packages/core/test/unit/validation/kinds.test.ts` (dep: T005)
- [ ] T015 [P] Tests de `RELATION_NOT_ALLOWED` y `FIELD_NOT_ALLOWED`: `inheritance` "class→class o interface→interface"; `realization` "class→interface"; relaciones UML prohibidas en C4 y `c4-rel` prohibida en clases; nada hacia/desde grupos; multiplicidades solo en `association`/`aggregation`/`composition`; `navigable` solo en `association`; `technology` solo en `c4-rel` — `packages/core/test/unit/validation/relations.test.ts` (dep: T005)
- [ ] T016 [P] Tests de `INHERITANCE_CYCLE`, `PARENT_CYCLE` e `INVALID_PARENT` ("`parentId` debe ser un grupo; `package` solo contiene elementos de clases; en `c4-component` un `component` debe estar dentro de un `boundary` de tipo `container`") — `packages/core/test/unit/validation/hierarchy.test.ts` (dep: T005)
- [ ] T017 [P] Tests de `LIMIT_EXCEEDED` (elementos > máximo configurable, contando grupos) y forma del error `{ code, path (JSON Pointer), message, hint }`; un lote con cualquier error se rechaza entero; un error de Zod se convierte en `SCHEMA_VIOLATION` con `path` JSON Pointer al campo (p. ej. `/elements/2/name`) — `packages/core/test/unit/validation/errors.test.ts` (dep: T005)
- [ ] T018 [P] Test del subconjunto JSON Schema común Claude/OpenAI: todo objeto con `additionalProperties: false`, uniones como `anyOf` (ningún `oneOf`), sin `$ref` recursivo, sin `format` — `packages/core/test/unit/model/json-schema-subset.test.ts` (dep: T005)

### Implementación del modelo

- [ ] T019 Enums del dominio: `DiagramType` (`class`, `c4-context`, `c4-container`, `c4-component`), `ClassElementKind`, `C4ElementKind`, `RelationKind` (`association`, `aggregation`, `composition`, `inheritance`, `realization`, `dependency`, `c4-rel`), `Visibility` (`+ - # ~`), `DiagramStyle` (`clean`, `sketch`), `ContainerVariant` (`default`, `database`, `queue`, `web`), `BoundaryType` (`enterprise`, `system`, `container`), `Navigability` (`none`, `source-to-target`, `both`), `ErrorCode` (los 12 códigos de data-model) y la tabla `ALLOWED_KINDS_BY_DIAGRAM` — `packages/core/src/model/enums.ts` (dep: T005)
- [ ] T020 Esquemas comunes: `ElementId`, `Point {x,y}`, `Layout {x,y,width,height,pinned}`, campos base de elemento (`id`, `kind`, `name`, `description?`, `parentId?`, `layout?`) — `packages/core/src/model/common.ts` (dep: T019)
- [ ] T021 [P] [US1] Esquemas de clases: `Attribute {name, type?, visibility, static?, defaultValue?}`, `Operation {name, parameters:{name,type?}[], returnType?, visibility, static?, abstract?}`, elementos `class` (`abstract?`, `attributes`, `operations`, `stereotype?`), `interface`, `enum` (`literals`), `package` — `packages/core/src/model/class-elements.ts` (dep: T020)
- [ ] T022 [P] [US2] Esquemas C4: `person` (`external?`), `software-system` (`external?`), `container` (`technology?`, `variant?`), `component` (`technology?`), `boundary` (`boundaryType`) — `packages/core/src/model/c4-elements.ts` (dep: T020)
- [ ] T023 Esquema `Relation` (`id`, `kind`, `source`, `target`, `label?`, `sourceMultiplicity?`, `targetMultiplicity?`, `navigable?`, `technology?`, `route?: Point[]`) — `packages/core/src/model/relation.ts` (dep: T020)
- [ ] T024 Esquema `Diagram` (`id`, `type`, `title`, `elements`, `relations`, `style`, `revision`, `createdAt`, `updatedAt`) y unión `Element` discriminada por `kind` (`anyOf`) — `packages/core/src/model/diagram.ts` (dep: T021, T022, T023)
- [ ] T025 [US3] Esquema `Operation` (lote 1–200) con `op`: `add_element`, `update_element` (`changes` parcial sin `id`/`kind`), `remove_element` (`cascade: "children"|"reparent"`, defecto `reparent`), `add_relation`, `update_relation`, `remove_relation`, `move_element` (`x`, `y`), `set_title`, `set_style` — `packages/core/src/model/operations.ts` (dep: T024)
- [ ] T026 Generador de JSON Schema (`z.toJSONSchema`) con post-proceso al subconjunto común (`oneOf`→`anyOf`, quita `format`, fuerza `additionalProperties:false`) — `packages/core/src/model/json-schema.ts`, `packages/core/src/model/index.ts` (dep: T024, T025; hace pasar T018)
- [ ] T027 `ValidationError` y fábrica con `code`, `path` (JSON Pointer), `message`, `hint`; conversión de errores Zod → `SCHEMA_VIOLATION` — `packages/core/src/validation/errors.ts` (dep: T019)

### Implementación de reglas de negocio

- [ ] T028 [P] Reglas `DUPLICATE_ID` y `UNKNOWN_REFERENCE` — `packages/core/src/validation/rules/references.ts` (dep: T024, T027; hace pasar T013)
- [ ] T029 [P] Regla `KIND_NOT_ALLOWED` — `packages/core/src/validation/rules/kinds.ts` (dep: T024, T027; hace pasar T014)
- [ ] T030 [P] Reglas `RELATION_NOT_ALLOWED` y `FIELD_NOT_ALLOWED` — `packages/core/src/validation/rules/relations.ts` (dep: T024, T027; hace pasar T015)
- [ ] T031 [P] Reglas `INHERITANCE_CYCLE`, `PARENT_CYCLE`, `INVALID_PARENT` — `packages/core/src/validation/rules/hierarchy.ts` (dep: T024, T027; hace pasar T016)
- [ ] T032 [P] Regla `LIMIT_EXCEEDED` (parametrizable por `maxElements`) — `packages/core/src/validation/rules/limits.ts` (dep: T024, T027)
- [ ] T033 `validateDiagram(diagram, opts)` que ejecuta esquema + todas las reglas y devuelve `{ ok, errors }` con un `hint` por error — `packages/core/src/validation/index.ts` (dep: T028–T032; hace pasar T017)

**Checkpoint**: T012–T018 en verde; el modelo y las reglas están completos y sin dependencias de framework.

---

## Phase 3: Persistencia de diagramas

**Purpose**: almacenamiento JSON por diagrama con escritura atómica (research R9).

- [ ] T034 [P] Tests del repositorio: guardar/leer/listar; escritura atómica (tmp + rename) sin archivos corruptos ante fallo simulado; `index.json` reconstruible si falta o está corrupto, y tras reconstruirlo el activo es el de `updatedAt` más reciente; archivo de diagrama inválido se ignora y se registra — `apps/api/test/integration/json-file.repository.test.ts` (dep: T024, T007)
- [ ] T035 [P] Tests del lock por diagrama: operaciones del mismo diagrama se serializan; diagramas distintos en paralelo — `apps/api/test/unit/diagram-lock.test.ts` (dep: T007)
- [ ] T036 Interfaz `DiagramRepository` (`get`, `save`, `list`, `getActiveId`, `setActiveId`) — `apps/api/src/diagrams/persistence/diagram.repository.ts` (dep: T024)
- [ ] T037 Generador de ids de diagrama "`dg_` + 12 chars base32" en el núcleo (el formato es parte del modelo) — `packages/core/src/model/ids.ts` (dep: T005)
- [ ] T038 `JsonFileDiagramRepository`: un archivo `<id>.json` por diagrama en `CHARTSIA_DATA_DIR`, `index.json` con resumen y `activeDiagramId` (al reconstruir el índice, activo = diagrama con `updatedAt` más reciente), creación del directorio al arrancar — `apps/api/src/diagrams/persistence/json-file.repository.ts` (dep: T036, T037, T008; hace pasar T034)
- [ ] T039 Mutex en memoria por `diagramId` — `apps/api/src/diagrams/persistence/diagram-lock.ts` (dep: T006; hace pasar T035)
- [ ] T040 Módulo de persistencia que provee el repositorio por token de inyección — `apps/api/src/diagrams/persistence/persistence.module.ts` (dep: T038, T039)

**Checkpoint**: diagramas sobreviven reinicios (FR-026).

---

## Phase 4: Servicios de aplicación

**Purpose**: operaciones, formas, layout, render y exportadores en el núcleo, y el servicio
de aplicación del hub que los orquesta.

### Tests primero

- [ ] T041 [P] [US3] Tests de `applyOperations`: lote atómico en orden; lote vacío o con más de 200 operaciones ⇒ `SCHEMA_VIOLATION`; `remove_element` elimina en cascada sus relaciones; grupo con `cascade: "reparent"` (defecto) reasigna hijos al padre del grupo; `reparent` que deja un `component` fuera de un `boundary` container ⇒ `INVALID_PARENT` con hint "usa cascade: children"; `cascade: "children"` elimina hijos y sus relaciones; `add_element` con `layout {x,y}` ⇒ `pinned=true`; `move_element` marca `pinned=true`; `update_element` no puede cambiar `id`/`kind`; `update_relation` y `remove_relation` (incluido id inexistente ⇒ `UNKNOWN_REFERENCE`); `set_title` fuera de "1–120 chars" y `set_style` inválido ⇒ error — `packages/core/test/unit/operations/apply.test.ts` (dep: T025, T033)
- [ ] T042 [P] Tests de medida de formas: tamaño de clase crece con atributos/operaciones; resultado idéntico entre ejecuciones (tabla de métricas fija) — `packages/core/test/unit/shapes/measure.test.ts` (dep: T024)
- [ ] T043 [P] Tests de layout: misma entrada ⇒ mismo `layout`/`route` byte a byte; sin solapes de nodos; ninguna arista atraviesa un nodo que no sea su origen, destino o grupo contenedor (FR-018); hijos dentro de su grupo; coordenadas enviadas por el agente se respetan y quedan `pinned`; incremental: los `pinned` no se mueven nunca, los existentes no fijados solo se mueven si hace falta eliminar un solape (FR-020, R7); 200 elementos en < 1 s — `packages/core/test/unit/layout/layout.test.ts` (dep: T024)
- [ ] T152 [P] [US3] Tests de eliminación de solapes: separa nodos solapados moviendo solo los no `pinned`, desplazamiento mínimo, determinista; dos `pinned` solapados se dejan y generan warning — `packages/core/test/unit/layout/overlap-removal.test.ts` (dep: T024)
- [ ] T044 [P] Fixtures golden de entrada: clases (biblioteca: Libro, Autor, Socio, Préstamo con herencia, composición, interfaz y enum) y C4 contenedores (tienda online con límite, BD, cola, sistema externo) + runner que compara salida con `.svg`, `.drawio`, `.excalidraw` esperados (`-u` solo con revisión) — `packages/core/test/golden/fixtures/library-class.json`, `packages/core/test/golden/fixtures/shop-c4-container.json`, `packages/core/test/golden/golden.test.ts` (dep: T024)
- [ ] T045 [P] Tests de seguridad de render/export: nombre `<img src=x onerror=alert(1)>` y `]]>&"'` aparecen escapados en SVG, draw.io y Excalidraw; el XML generado no contiene `<!DOCTYPE`/`<!ENTITY` — `packages/core/test/unit/export/escaping.test.ts` (dep: T024)
- [ ] T046 [P] Tests de los servicios de aplicación con repositorio en memoria: `create` valida→layout→persiste→emite `diagram.created` y `active.changed`; `apply` usa el lock, incrementa `revision`, emite `diagram.updated {origin}`; error de validación no persiste ni emite; `diagramId` omitido ⇒ activo o `NO_ACTIVE_DIAGRAM`; `diagramId` inexistente ⇒ `DIAGRAM_NOT_FOUND` en `apply`, `get` y `activate`; `activate` emite `active.changed`; `baseRevision` distinta ⇒ warning — `apps/api/test/unit/diagram-command.service.test.ts`, `apps/api/test/unit/diagram-query.service.test.ts` (dep: T040, T033)

### Núcleo: operaciones, formas, layout, render

- [ ] T047 [US3] `applyOperations(diagram, ops)` puro que devuelve nuevo diagrama o errores — `packages/core/src/operations/apply.ts` (dep: T025, T033; hace pasar T041)
- [ ] T048 Tabla de métricas de texto fija para las dos fuentes empaquetadas, Inter (clean) y Excalifont (sketch), y `measureText` — `packages/core/src/shapes/text-metrics.ts` (dep: T005)
- [ ] T049 Tipos de primitivas declarativas (`rect`, `path`, `ellipse`, `line`, `text-slot`) y contrato `ShapeDefinition { measure(element), primitives(element, size) }` — `packages/core/src/shapes/types.ts` (dep: T024)
- [ ] T050 [P] [US1] Formas UML inspiradas en `mxUML25` de draw.io: clase de 3 compartimentos (nombre en negrita, cursiva si abstracta, `«stereotype»`), interfaz `«interface»`, enum `«enumeration»` con literales, paquete con pestaña — `packages/core/src/shapes/uml/class.ts`, `packages/core/src/shapes/uml/interface.ts`, `packages/core/src/shapes/uml/enum.ts`, `packages/core/src/shapes/uml/package.ts` (dep: T048, T049)
- [ ] T051 [P] [US1] Marcadores de relación UML: herencia (triángulo vacío, línea sólida), realización (triángulo vacío, discontinua), composición (rombo lleno), agregación (rombo vacío), dependencia (flecha abierta discontinua), asociación (flecha abierta según `navigable`) — `packages/core/src/shapes/uml/markers.ts` (dep: T049)
- [ ] T052 [P] [US2] Formas C4 persona y sistema, inspiradas en `mxC4` de draw.io: persona cabeza+cuerpo; sistema rectángulo redondeado; variante `external` en gris — `packages/core/src/shapes/c4/person.ts`, `packages/core/src/shapes/c4/software-system.ts` (dep: T048, T049, T151)
- [ ] T149 [P] [US2] Forma C4 contenedor con variantes: `default` rectángulo, `database` cilindro, `queue` cilindro horizontal, `web` ventana — `packages/core/src/shapes/c4/container.ts` (dep: T048, T049, T151)
- [ ] T150 [P] [US2] Formas C4 componente y límite: componente rectangular; límite discontinuo con etiqueta `[tipo]` según `boundaryType` — `packages/core/src/shapes/c4/component.ts`, `packages/core/src/shapes/c4/boundary.ts` (dep: T048, T049, T151)
- [ ] T151 [P] [US2] Paleta C4 (`#08427B` persona, `#1168BD` sistema, `#438DD5` contenedor, `#85BBF0` componente, `#999999` externos) y definición de la leyenda — `packages/core/src/shapes/c4/palette.ts`, `packages/core/src/shapes/c4/legend.ts` (dep: T049)
- [ ] T053 Registro de formas por `kind` + `measureElement` — `packages/core/src/shapes/registry.ts` (dep: T050, T051, T052, T149, T150, T151; hace pasar T042)
- [ ] T054 Conversión modelo → grafo ELK (orden estable por id, grupos como nodos compuestos, `hierarchyHandling: INCLUDE_CHILDREN`, `edgeRouting: ORTHOGONAL`, `randomSeed` fijo) — `packages/core/src/layout/elk-graph.ts` (dep: T053)
- [ ] T055 [US1] Layout completo `layoutDiagram(diagram)` que rellena `layout` y `route`; los elementos con coordenadas del agente se fijan en su posición (`pinned`) y ELK coloca el resto — `packages/core/src/layout/full-layout.ts` (dep: T054)
- [ ] T056 [US3] Layout incremental: ELK interactivo (`layering.strategy: INTERACTIVE`, `crossingMinimization.semiInteractive: true`) sembrado con posiciones previas y re-enrutado de aristas afectadas; delega en T153 la eliminación de solapes — `packages/core/src/layout/incremental-layout.ts` (dep: T055, T153; hace pasar T043)
- [ ] T153 [US3] Eliminación de solapes: mueve solo nodos no `pinned`, desplazamiento mínimo y orden estable por id — `packages/core/src/layout/overlap-removal.ts` (dep: T054; hace pasar T152)
- [ ] T057 [P] Render clean: primitivas → string SVG con escape de todo texto — `packages/core/src/render/svg-clean.ts` (dep: T053)
- [ ] T058 [P] [US4] Render sketch: primitivas → roughjs (`rough.generator`) con `seed` derivado del hash del id del elemento — `packages/core/src/render/sketch.ts` (dep: T053)

### Núcleo: exportadores

- [ ] T059 [P] Escritor/escape XML sin DOCTYPE ni entidades — `packages/core/src/export/xml-escape.ts` (dep: T005)
- [ ] T060 [US5] Exportador SVG (estilos `clean` y `sketch`, leyenda C4 incluida) — `packages/core/src/export/svg.ts` (dep: T055, T057, T058, T059)
- [ ] T061 [P] [US5] Exportador draw.io, base y clases: `<mxfile><diagram><mxGraphModel>` sin comprimir; clases como `swimlane` + `childLayout=stackLayout` con celdas por miembro; aristas con `endArrow` según tipo UML y `mxPoint` desde `route` — `packages/core/src/export/drawio.ts`, `packages/core/src/export/drawio-class.ts` (dep: T055, T059)
- [ ] T154 [P] [US5] Exportador draw.io, C4: `shape=mxgraph.c4.person2` y demás formas `mxgraph.c4.*`, `UserObject` (`c4Name`, `c4Type`, `c4Description`, `c4Technology`), límites como contenedores — `packages/core/src/export/drawio-c4.ts` (dep: T061)
- [ ] T062 [P] [US5] Exportador Excalidraw: `{type:"excalidraw", version:2, source, elements, appState, files:{}}`; formas `rectangle`/`ellipse`, texto con `containerId` y `boundElements`, flechas con `startBinding`/`endBinding` y `points` de `route`; `seed`/`versionNonce` derivados del id; `index` fraccional en orden — `packages/core/src/export/excalidraw.ts` (dep: T055)
- [ ] T063 Barrel de exportación pública del núcleo (`model`, `validation`, `operations`, `shapes`, `layout`, `render`, `export`) — `packages/core/src/index.ts` con subpath exports (`@chartsia/core/model`, `/shapes`, `/render`, …) para que la web no cargue `elkjs` (dep: T047, T056, T060, T061, T062, T154; hace pasar T044, T045)

### Hub: servicios de aplicación

- [ ] T064 Bus de eventos de dominio (`diagram.created`, `diagram.updated`, `active.changed`) — `apps/api/src/diagrams/diagram-events.ts` (dep: T006)
- [ ] T065 `DiagramCommandService`: `create`, `apply(diagramId?, baseRevision?, operations, origin)`, `activate`; única ruta de escritura para MCP y app; usa el lock y emite eventos. No construye URLs — `apps/api/src/diagrams/diagram-command.service.ts` (dep: T040, T047, T056, T064; hace pasar T046)
- [ ] T155 `DiagramQueryService`: `get(diagramId?, includeLayout)`, `list()`, resolución del activo y `DIAGRAM_NOT_FOUND`/`NO_ACTIVE_DIAGRAM` — `apps/api/src/diagrams/diagram-query.service.ts` (dep: T040; hace pasar T046)
- [ ] T066 [US5] `ExportService`: formato `svg|drawio|excalidraw`, `mimeType`, `filename`, `content` omitido si excede 512 KiB (solo `downloadUrl`) — `apps/api/src/diagrams/export.service.ts` (dep: T063, T155)
- [ ] T067 `DiagramsModule` que registra servicios, eventos y persistencia — `apps/api/src/diagrams/diagrams.module.ts` (dep: T065, T066, T155)

**Checkpoint**: el núcleo genera diagramas dispuestos y exportados; el servicio de aplicación está verde.

---

## Phase 5: API REST (y superficies MCP / WebSocket)

**Purpose**: exponer el servicio de aplicación por REST ([app-api.md](./contracts/app-api.md)),
MCP ([mcp-tools.md](./contracts/mcp-tools.md)) y Socket.IO. Sin lógica de dominio en esta capa.

### Transversal

- [ ] T068 Guard Bearer: exige `Authorization: Bearer <token>` (HTTP) o `auth.token` (handshake Socket.IO) solo si `CHARTSIA_HOST` no es loopback; `/api/health` excluido — `apps/api/src/auth/bearer.guard.ts` (dep: T156)
- [ ] T156 Gestión del token: lee `CHARTSIA_TOKEN` o lo genera al primer arranque, lo persiste en `CHARTSIA_DATA_DIR` y lo muestra una vez junto con la URL `{CHARTSIA_PUBLIC_URL}/#token=…`; comparación en tiempo constante — `apps/api/src/auth/token.ts` (dep: T008, T009)
- [ ] T069 Filtro de excepciones: `ValidationError[]` → HTTP 422 `{ errors }`; `DIAGRAM_NOT_FOUND` → 404; `LIMIT_EXCEEDED` por tamaño → 413 — `apps/api/src/common/domain-exception.filter.ts` (dep: T027)

### REST

- [ ] T070 [US1] `DiagramsController`: `GET /api/diagrams`, `GET /api/diagrams/:id` (con `layout` y `route`), `POST /api/diagrams/:id/operations` (`{ baseRevision, operations }`, `origin: "app"`), `POST /api/diagrams/:id/activate` (204) — `apps/api/src/diagrams/diagrams.controller.ts` (dep: T065, T155, T068, T069)
- [ ] T071 [P] [US5] `GET /api/diagrams/:id/export?format=svg|drawio|excalidraw&style=` con `Content-Disposition` — `apps/api/src/diagrams/export.controller.ts` (dep: T066, T068)

### WebSocket

- [ ] T072 [US1] `LiveGateway` (namespace `/live`): `subscribe {diagramId}` une a la room; reenvía `diagram.updated {diagramId, revision, origin, diagram}`, `diagram.created`, `active.changed`; aplica el guard en el handshake (`auth.token`) — `apps/api/src/live/live.gateway.ts`, `apps/api/src/live/live.module.ts` (dep: T064, T068)

### MCP

- [ ] T073 Fábrica `McpServer` (nombre `chartsia`, versión de esquema `1.0.0`) que registra tools y recursos con JSON Schema de T026 — `apps/api/src/mcp/mcp-server.factory.ts` (dep: T026, T065, T155)
- [ ] T074 Formateador de resultados: construye `viewUrl` = `{CHARTSIA_PUBLIC_URL}/d/{id}`; éxito `structuredContent` + `content[0]` texto con resumen y `viewUrl`, y en tools que modifican `content[1]` `resource_link` a `chartsia://diagrams/{id}/export.svg`; error `isError: true`, `structuredContent: { errors }` y texto legible — `apps/api/src/mcp/tool-result.ts` (dep: T008, T027)
- [ ] T075 [P] [US1] Tool `create_diagram` con descripción y ejemplo de [mcp-tools.md](./contracts/mcp-tools.md); output `{ diagramId, revision, viewUrl, counts, warnings }` — `apps/api/src/mcp/tools/create-diagram.tool.ts` (dep: T073, T074, T084, T089)
- [ ] T076 [P] [US3] Tool `apply_changes` con descripción y ejemplo (FR-003): (`diagramId?`, `baseRevision?`, `operations`) → `{ diagramId, revision, viewUrl, applied, warnings }` — `apps/api/src/mcp/tools/apply-changes.tool.ts` (dep: T073, T074, T085)
- [ ] T077 [P] [US3] Tool `get_diagram` con descripción y ejemplo (`diagramId?`, `includeLayout?` defecto false) — `apps/api/src/mcp/tools/get-diagram.tool.ts` (dep: T073, T074, T086)
- [ ] T078 [P] [US3] Tool `list_diagrams` con descripción y ejemplo → `{ activeDiagramId, diagrams[] }` — `apps/api/src/mcp/tools/list-diagrams.tool.ts` (dep: T073, T074, T086)
- [ ] T079 [P] [US5] Tool `export_diagram` con descripción y ejemplo (`format`, `style?`) → `{ diagramId, format, mimeType, filename, downloadUrl, content }` — `apps/api/src/mcp/tools/export-diagram.tool.ts` (dep: T066, T073, T074, T087)
- [ ] T157 [P] [US3] Tool `open_diagram` (`diagramId`) → `{ diagramId, viewUrl }`; llama a `activate` (equivalente MCP de `POST /activate`) — `apps/api/src/mcp/tools/open-diagram.tool.ts` (dep: T073, T074, T158)
- [ ] T080 [P] Recursos `chartsia://diagrams/{id}`, `chartsia://diagrams/{id}/export.{ext}` y `chartsia://schema/{type}` (guía de kinds y relaciones permitidas por tipo, apoya FR-003) — `apps/api/src/mcp/resources.ts` (dep: T066, T073, T087)
- [ ] T081 `McpController` Streamable HTTP stateless en `POST/GET/DELETE /mcp` (servidor + transporte por petición) con guard — `apps/api/src/mcp/mcp.controller.ts`, `apps/api/src/mcp/mcp.module.ts` (dep: T075–T080, T157, T068)
- [ ] T082 Puente stdio `chartsia-mcp`: `StdioServerTransport` ↔ `StreamableHTTPClientTransport` hacia `CHARTSIA_URL` (defecto `http://127.0.0.1:3333/mcp`) con token opcional; mensaje claro si el hub no está corriendo — `apps/api/src/stdio-bridge.ts` (dep: T081)
- [ ] T083 Registrar `DiagramsModule`, `LiveModule`, `McpModule` y el filtro global en `AppModule` — `apps/api/src/app.module.ts` (dep: T067, T070, T071, T072, T081, T148)
- [ ] T160 Servir la app compilada: `ServeStaticModule` con `apps/web/dist` en `/`, fallback a `index.html` para `/d/:id`, excluyendo `/api`, `/mcp` y `/socket.io`; se activa solo si existe `dist` — `apps/api/src/web/web-static.module.ts`, `apps/api/src/app.module.ts` (dep: T083)

**Checkpoint**: hub completo; un agente puede crear y editar diagramas.

---

## Phase 6: Tests backend

**Purpose**: contract, integración y seguridad del hub (principio V).
**Nota TDD (principio V)**: T084–T089 y T158 se escriben **antes** de las tools de la Fase 5;
las tools T075–T080 y T157 dependen explícitamente de ellos. Deben fallar hasta que existan.

- [ ] T159 Arnés de tests MCP: `Client` del SDK sobre `InMemoryTransport` conectado a la fábrica de T073 con repositorio en memoria y reloj fijo; helpers de fixtures — `apps/api/test/support/mcp-test-harness.ts` (dep: T026, T065, T155)
- [ ] T084 [P] [US1] Contract `create_diagram` (InMemoryTransport + `Client` del SDK): entrada mínima, entrada completa, cada código de error alcanzable, `additionalProperties` rechazado, determinismo (dos llamadas iguales ⇒ mismo layout) — `apps/api/test/contract/create-diagram.contract.test.ts` (dep: T026, T065, T159)
- [ ] T085 [P] [US3] Contract `apply_changes`: atomicidad, cascada, `NO_ACTIVE_DIAGRAM`, `DIAGRAM_NOT_FOUND`, warning por `baseRevision`, nodos `pinned` intactos — `apps/api/test/contract/apply-changes.contract.test.ts` (dep: T026, T065, T159)
- [ ] T086 [P] [US3] Contract `get_diagram` y `list_diagrams` (refleja `move_element` hecho por la app; `DIAGRAM_NOT_FOUND` con id inexistente) — `apps/api/test/contract/read-tools.contract.test.ts` (dep: T026, T065, T159)
- [ ] T087 [P] [US5] Contract `export_diagram`: tres formatos, `content` omitido > 512 KiB, recurso MCP equivalente — `apps/api/test/contract/export-diagram.contract.test.ts` (dep: T026, T066, T159)
- [ ] T088 [P] [US2] Contract C4: diagrama de contenedores válido; `component` fuera de `boundary` container ⇒ `INVALID_PARENT`; relación `inheritance` en C4 ⇒ `RELATION_NOT_ALLOWED` — `apps/api/test/contract/c4.contract.test.ts` (dep: T026, T065, T159)
- [ ] T089 [P] Contract del listado de tools: los 6 esquemas cumplen el subconjunto común (sin `oneOf`, `additionalProperties:false`) y cada `description` incluye un ejemplo de entrada (FR-003) — `apps/api/test/contract/tools-schema.contract.test.ts` (dep: T026, T159)
- [ ] T158 [P] [US3] Contract `open_diagram`: activa el diagrama, `list_diagrams` lo refleja, emite `active.changed`; id inexistente ⇒ `DIAGRAM_NOT_FOUND` — `apps/api/test/contract/open-diagram.contract.test.ts` (dep: T026, T159)
- [ ] T090 [P] Contract sobre HTTP real (`StreamableHTTPClientTransport` contra la app Nest levantada) del flujo crear → aplicar → exportar — `apps/api/test/contract/http-transport.contract.test.ts` (dep: T083)
- [ ] T091 [P] Smoke del puente stdio: compilar (`pnpm --filter @chartsia/api build` en `globalSetup`), lanzar `chartsia-mcp` como proceso hijo y listar tools / crear diagrama — `apps/api/test/contract/stdio-bridge.contract.test.ts` (dep: T082, T083)
- [ ] T092 [P] Integración REST: códigos 200/204/404/413/422, export con `Content-Disposition` — `apps/api/test/integration/diagrams-rest.test.ts` (dep: T083)
- [ ] T093 [P] Integración WebSocket: cliente suscrito recibe `diagram.updated` tras una llamada MCP con `origin: "agent"` y tras REST con `origin: "app"` — `apps/api/test/integration/live-gateway.test.ts` (dep: T083)
- [ ] T094 [P] Integración auth: con `CHARTSIA_HOST=0.0.0.0` sin token ⇒ 401 en `/mcp`, `/api`, `/live`; con token ⇒ OK (header en REST/MCP, `auth.token` en el handshake); `/api/health` sin token ⇒ 200; loopback sin token ⇒ OK; el token no aparece en logs — `apps/api/test/integration/auth.test.ts` (dep: T083)
- [ ] T095 [P] Integración de límites: petición > 1 MiB ⇒ 413/`LIMIT_EXCEEDED`; > 500 elementos ⇒ `LIMIT_EXCEEDED` con el límite en el mensaje — `apps/api/test/integration/limits.test.ts` (dep: T083)
- [ ] T096 Test de rendimiento: `create_diagram` de 30 elementos responde en < 500 ms en el hub (presupuesto interno para cumplir SC-001 < 2 s de punta a punta) y layout de 200 en < 1 s — `apps/api/test/integration/performance.test.ts` (dep: T056, T083)

**Checkpoint**: `pnpm --filter @chartsia/core test` y `pnpm --filter @chartsia/api test` en verde.

---

# FRONTEND

## Phase 7: Setup frontend

**Purpose**: app React compilando, con tests y proxy al hub.

- [ ] T097 Crear paquete `@chartsia/web` (React 19, Vite 8, `@xyflow/react@^12`, `zustand@^5`, `socket.io-client@^4.8`, `@chartsia/core: workspace:*`) — `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/index.html` (dep: T002, T005)
- [ ] T098 Vite con proxy `/api`, `/mcp` y `/socket.io` (`ws: true`) → `http://127.0.0.1:${CHARTSIA_PORT ?? 3333}` — `apps/web/vite.config.ts` (dep: T008, T097)
- [ ] T099 [P] Vitest + Testing Library + jsdom — `apps/web/vitest.config.ts`, `apps/web/test/setup.ts` (dep: T097)
- [ ] T100 [P] Playwright apuntando a hub + app levantados por `webServer` — `apps/web/playwright.config.ts` (dep: T097)
- [ ] T101 [P] Fuentes locales Inter (clean) y Excalifont (sketch), las mismas cuyas métricas usa el núcleo (T048), y tokens de diseño (colores C4, tipografías clean/sketch) — `apps/web/public/fonts/Inter-Regular.woff2`, `apps/web/public/fonts/Excalifont-Regular.woff2`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles/global.css` (dep: T097)
- [ ] T102 Entrada de la app con `ReactFlowProvider` y estilos de `@xyflow/react` — `apps/web/src/main.tsx`, `apps/web/src/App.tsx` (dep: T097)
- [ ] T161 Router de la app: `/` (activo o estado vacío) y `/d/:id` (destino de `viewUrl`) — `apps/web/src/app/routes.tsx`, `apps/web/src/App.tsx` (dep: T102)
- [ ] T103 Actualizar script raíz `pnpm dev` para levantar hub y app en paralelo — `package.json` (dep: T010, T102)

---

## Phase 8: Pantallas frontend

**Purpose**: pantallas y componentes visuales con datos de ejemplo (sin conexión todavía).

### Tests de componentes primero

- [ ] T104 [P] [US1] Tests de `UmlClassNode`: 3 compartimentos, visibilidad `+ - # ~`, abstracta en cursiva, estereotipo; nombres con HTML se ven como texto literal — `apps/web/test/unit/nodes/uml-class-node.test.tsx` (dep: T099)
- [ ] T105 [P] [US2] Tests de nodos C4: etiqueta de tipo `[Container: tech]`, variante `database`, externo en gris — `apps/web/test/unit/nodes/c4-nodes.test.tsx` (dep: T099)
- [ ] T106 [P] Tests de `RoutedEdge`: dibuja la polilínea de `route`, marcador correcto por `kind`, etiqueta "descripción [tecnología]" en `c4-rel` — `apps/web/test/unit/edges/routed-edge.test.tsx` (dep: T099)

### Renderizado de formas (comparte geometría con el núcleo)

- [ ] T107 Adaptador primitivas → JSX SVG para estilo clean — `apps/web/src/render/CleanShape.tsx` importando solo `@chartsia/core/shapes` y `/render` (dep: T053, T063, T102)
- [ ] T108 [P] [US4] Adaptador roughjs → JSX SVG para estilo sketch (memoizado por id+tamaño) — `apps/web/src/render/SketchShape.tsx` (dep: T058, T102)
- [ ] T109 `ShapeRenderer` que elige clean/sketch según el estilo del diagrama — `apps/web/src/render/ShapeRenderer.tsx` (dep: T107, T108)

### Nodos, aristas y lienzo

- [ ] T110 [P] [US1] Nodos UML `UmlClassNode`, `UmlInterfaceNode`, `UmlEnumNode` (con handles de conexión) — `apps/web/src/nodes/uml/UmlClassNode.tsx`, `apps/web/src/nodes/uml/UmlInterfaceNode.tsx`, `apps/web/src/nodes/uml/UmlEnumNode.tsx` (dep: T109, T121; hace pasar T104)
- [ ] T111 [P] [US2] Nodos C4 `C4PersonNode`, `C4SystemNode`, `C4ContainerNode`, `C4ComponentNode` — `apps/web/src/nodes/c4/C4PersonNode.tsx`, `apps/web/src/nodes/c4/C4SystemNode.tsx`, `apps/web/src/nodes/c4/C4ContainerNode.tsx`, `apps/web/src/nodes/c4/C4ComponentNode.tsx` (dep: T109, T121; hace pasar T105)
- [ ] T112 [P] `GroupNode` para `package` y `boundary` (sub-flow con `parentId`) — `apps/web/src/nodes/GroupNode.tsx` (dep: T109)
- [ ] T113 Registro `nodeTypes` — `apps/web/src/nodes/index.ts` (dep: T110, T111, T112)
- [ ] T114 [P] `RoutedEdge` + definiciones de marcadores SVG UML/C4 — `apps/web/src/edges/RoutedEdge.tsx`, `apps/web/src/edges/markers.tsx`, `apps/web/src/edges/index.ts` (dep: T051, T102; hace pasar T106)
- [ ] T115 [US1] `DiagramCanvas`: `ReactFlow` con `nodeTypes`/`edgeTypes`, `Background`, `MiniMap`, `Controls`, `fitView`, pan/zoom infinito — `apps/web/src/canvas/DiagramCanvas.tsx` (dep: T113, T114)
- [ ] T116 [P] [US2] Leyenda C4 flotante (solo en diagramas C4) — `apps/web/src/legend/C4Legend.tsx` (dep: T151, T102)

### Pantallas

- [ ] T117 [P] [US4] Barra lateral con lista de diagramas (título, tipo, fecha) y diagrama activo resaltado — `apps/web/src/app/DiagramList.tsx` (dep: T102)
- [ ] T118 [P] [US4] Toolbar: alternar estilo clean/sketch, ajustar a pantalla, menú exportar (SVG, draw.io, Excalidraw) — `apps/web/src/app/Toolbar.tsx` (dep: T102)
- [ ] T119 [P] Indicador de conexión con el hub (conectado / reconectando / desconectado) — `apps/web/src/app/ConnectionStatus.tsx` (dep: T102)
- [ ] T120 [P] Estado vacío "conecta tu agente" con comandos de [quickstart.md](./quickstart.md) para Claude y OpenAI (mantener sincronizado con quickstart en el mismo PR) — `apps/web/src/app/EmptyState.tsx` (dep: T102)
- [ ] T121 [US4] Componente de edición de texto en línea (doble clic sobre nombre/miembro), usado por los nodos — `apps/web/src/nodes/InlineEditableText.tsx` (dep: T102)
- [ ] T122 `AppShell` que compone barra lateral, toolbar, lienzo, leyenda y estado vacío — `apps/web/src/app/AppShell.tsx` (dep: T115, T116, T117, T118, T119, T120, T161)

---

## Phase 9: Integración frontend-backend

**Purpose**: la app refleja en vivo los cambios del agente y envía los manuales por la misma
ruta de escritura.

- [ ] T123 [P] Tests del mapeo modelo → React Flow (`layout` → `position`/`width`/`height`, grupos con `parentId` y posiciones relativas, `route` → `data.points`) — `apps/web/test/unit/canvas/to-react-flow.test.ts` (dep: T099, T024)
- [ ] T124 [P] Tests del store: aplica `diagram.updated` solo si `revision` es mayor; reconciliación al reconectar — `apps/web/test/unit/state/diagram-store.test.ts` (dep: T099)
- [ ] T165 Token de la app: lee `#token=` del fragmento una vez, lo guarda en `sessionStorage`, lo quita con `history.replaceState`; pantalla para pegar el token si el hub responde 401 — `apps/web/src/state/auth-token.ts`, `apps/web/src/app/TokenPrompt.tsx` (dep: T097)
- [ ] T125 Cliente REST tipado según [app-api.md](./contracts/app-api.md), que envía `Authorization: Bearer` cuando hay token (T165); 401 ⇒ pide el token — `apps/web/src/state/api-client.ts` (dep: T097, T165)
- [ ] T126 Cliente Socket.IO: `io("/live", { path: "/socket.io", auth: { token } })` (`subscribe`, eventos, reconexión con reenvío de `subscribe`) — `apps/web/src/state/live-client.ts` (dep: T097, T165)
- [ ] T127 Store zustand: diagramas, activo, diagrama abierto, estado de conexión — `apps/web/src/state/diagram-store.ts` (dep: T125, T126; hace pasar T124)
- [ ] T128 [US1] Mapeo modelo → nodos/aristas React Flow — `apps/web/src/canvas/to-react-flow.ts` con las claves de `nodeTypes`/`edgeTypes` y la convención de `parentId` de los grupos (dep: T024, T112, T113, T114; hace pasar T123)
- [ ] T129 [US1] Conectar `DiagramCanvas` y `DiagramList` al store; clic en la lista o ruta `/d/:id` abre el diagrama y llama a `POST /api/diagrams/:id/activate`; `active.changed` y `diagram.created` navegan al diagrama — `apps/web/src/canvas/DiagramCanvas.tsx`, `apps/web/src/app/DiagramList.tsx` (dep: T122, T127, T128, T161)
- [ ] T130 [US4] Arrastrar nodo → `move_element` al soltar (`onNodeDragStop`) vía `POST /api/diagrams/:id/operations` — `apps/web/src/canvas/use-diagram-edits.ts` (dep: T129)
- [ ] T131 [US4] Edición en línea → `update_element` vía `POST /api/diagrams/:id/operations` — `apps/web/src/canvas/use-diagram-edits.ts` (dep: T121, T130)
- [ ] T162 [US4] Tecla Supr sobre selección → `remove_element`/`remove_relation` — `apps/web/src/canvas/use-diagram-edits.ts` (dep: T131)
- [ ] T163 [US4] Aviso de errores: respuestas 422 con `{errors}` mostradas con `message` y `hint`; el estado local no cambia — `apps/web/src/app/ErrorToast.tsx`, `apps/web/src/state/api-client.ts` (dep: T125, T122)
- [ ] T132 [US4] Cambio de estilo → `set_style` vía `POST /api/diagrams/:id/operations`; el estilo persiste — `apps/web/src/app/Toolbar.tsx` (dep: T118, T127)
- [ ] T164 [US5] Menú exportar → descarga desde `GET /api/diagrams/:id/export` (con token si aplica) — `apps/web/src/app/Toolbar.tsx`, `apps/web/src/state/api-client.ts` (dep: T132, T125)
- [ ] T133 Resincronización tras reconexión y estado de conexión en `ConnectionStatus` — `apps/web/src/state/live-client.ts`, `apps/web/src/app/ConnectionStatus.tsx` (dep: T126, T119)
- [ ] T134 [US3] (Opcional, fuera del MVP; no lo pide la spec) Animación suave al aplicar cambios del agente (solo nodos movidos), sin afectar a nodos `pinned` — `apps/web/src/canvas/DiagramCanvas.tsx` (dep: T129)

**Checkpoint**: con el hub y la app levantados, un agente crea y edita diagramas que se ven en vivo.

---

## Phase 10: Validación end-to-end según quickstart.md

**Purpose**: comprobar los 10 escenarios de [quickstart.md](./quickstart.md) y los criterios de éxito.

- [ ] T135 Agente simulado: script que usa el `Client` del SDK MCP sobre HTTP para ejecutar escenarios guionados (crear, refinar ×3, exportar) — `apps/web/test/e2e/support/fake-agent.ts` (dep: T083)
- [ ] T136 [US1] E2E Playwright escenarios 1–2: diagrama de biblioteca visible en < 2 s, sin solapes de nodos ni aristas que atraviesen nodos, layout idéntico al repetir; `viewUrl` abre `/d/:id` — `apps/web/test/e2e/us1-class-diagram.spec.ts` (dep: T129, T135, T100)
- [ ] T137 [P] [US1] E2E escenario 3: error `UNKNOWN_REFERENCE` y nada cambia en la app — `apps/web/test/e2e/us1-validation-error.spec.ts` (dep: T129, T135, T100)
- [ ] T138 [P] [US2] E2E escenario 4: C4 tienda online con límite, BD cilindro, etiquetas `desc [tech]` y leyenda — `apps/web/test/e2e/us2-c4-container.spec.ts` (dep: T129, T135, T100)
- [ ] T139 [P] [US3] E2E escenario 5: tres refinamientos en vivo sin mover elementos no afectados — `apps/web/test/e2e/us3-refine.spec.ts` (dep: T129, T135, T100)
- [ ] T140 [P] [US4] E2E escenarios 6–7: nodo movido a mano conserva posición tras añadido del agente; estilo persiste tras recargar — `apps/web/test/e2e/us4-manual-edit.spec.ts` (dep: T131, T132, T162, T163, T135, T100)
- [ ] T141 [P] [US5] E2E escenario 8 (automatizable): exportar draw.io y Excalidraw y validar estructura (parse XML `mxGraphModel`, JSON `type:"excalidraw"`, bindings resueltos) — `apps/web/test/e2e/us5-export.spec.ts` (dep: T164, T135, T100)
- [ ] T142 [P] E2E escenario 10: nombre `<img src=x onerror=alert(1)>` se ve literal en la app y en el SVG; ningún diálogo se dispara — `apps/web/test/e2e/security-xss.spec.ts` (dep: T129, T135, T100)
- [ ] T143 [P] E2E SC-006: diagrama de 200 elementos, pan/zoom sostenido ≥ 50 fps (trazas de rendimiento), mismo umbral que plan.md — `apps/web/test/e2e/perf-large-diagram.spec.ts` (dep: T129, T135, T100)
- [ ] T167 [P] E2E de métricas de texto: el tamaño que calcula el núcleo (T048) para nombres y miembros contiene el texto medido en el DOM con las fuentes de T101, en clean y sketch — `apps/web/test/e2e/text-metrics.spec.ts` (dep: T101, T129, T135, T100)
- [ ] T166 Conjunto de evaluación: 20 peticiones de diagramas (clases y C4) para SC-002 y 10 peticiones que provocan errores de validación para SC-003, con criterio de aceptación por petición — `specs/001-mcp-class-c4-diagrams/eval-prompts.md` (dep: —)
- [ ] T144 Validación manual con Claude Code (HTTP) y Claude Desktop (puente stdio): escenarios 1, 3, 4, 5, 8; ejecutar `eval-prompts.md` y medir SC-002 (≥ 95 % sin solapes en 20 peticiones) y SC-003 (≥ 90 % de errores autocorregidos); anotar resultados — `specs/001-mcp-class-c4-diagrams/validation-report.md` (dep: T136–T142, T166)
- [ ] T145 Validación manual con OpenAI Responses API vía túnel y token (escenario 9 / SC-004, repitiendo `eval-prompts.md`) y apertura real de exports en app.diagrams.net y excalidraw.com (SC-005) — `specs/001-mcp-class-c4-diagrams/validation-report.md` (dep: T144)
- [ ] T146 [P] Actualizar README con instalación, conexión de agentes y token por fragmento fuera de loopback y limitación de ChatGPT UI (OAuth) — `README.md` (dep: T145)
- [ ] T147 Ejecutar `pnpm typecheck && pnpm lint && pnpm test` y Constitution Check final (principios I–VI) registrado en el informe — `specs/001-mcp-class-c4-diagrams/validation-report.md` (dep: T146)

---

## Dependencies & Execution Order

### Orden de fases

```text
F1 Setup backend ─► F2 Dominio ─► F3 Persistencia ─► F4 Servicios ─► F5 API ─► F6 Tests backend
                        │                                 │              ▲
                        │                                 └► T159, T084–T089, T158 (contract, TDD)
                        │                                    deben existir antes de T075–T080, T157
                        └───────────────► F7 Setup frontend (solo necesita T002, T005)
F4 (T051–T053, T058) ─► F8 Pantallas ─► F9 Integración (necesita F5) ─► F10 E2E
```

- **F2** bloquea todo lo demás; sus tests (T012–T018) van antes de T019–T033.
- **F6**: los contract tests T084–T089 y T158 (con el arnés T159) se escriben en cuanto existen T026, T065 y T155, y son dependencia explícita de las tools de F5 (principio V).
- **F7** puede empezar en paralelo a F3–F6.
- **F8** necesita el registro de formas del núcleo (T053, T058) y los subpath exports (T063), pero no el hub.
- **F9** necesita F5 (REST + WS) y F8.
- **F10** necesita F9 completo.

### Historias de usuario (trazabilidad)

| Historia | Tareas clave | Prueba independiente |
|----------|--------------|----------------------|
| US1 (P1) MVP | T021, T050, T051, T055, T070, T072, T075, T084, T104, T110, T115, T128, T129, T136, T137, T160, T161 | pedir un diagrama de clases y verlo completo en vivo |
| US2 (P2) | T022, T052, T149–T151, T088, T105, T111, T116, T138 | pedir un C4 de contenedores con notación, límite y leyenda |
| US3 (P2) | T025, T041, T047, T056, T152, T153, T076–T078, T085, T086, T157, T158, T139 | tres cambios sucesivos sin desordenar el resto |
| US4 (P3) | T058, T108, T117, T118, T121, T130–T132, T162, T163, T140 | mover, editar, cambiar estilo y recargar |
| US5 (P3) | T060–T062, T154, T066, T071, T079, T087, T164, T141, T145 | exportar y abrir en draw.io / Excalidraw |

## Parallel Examples

```text
# F2 – tests de reglas en paralelo
T012, T013, T014, T015, T016, T017, T018

# F2 – reglas en paralelo (tras T024 + T027)
T028, T029, T030, T031, T032

# F4 – formas en paralelo (tras T151)
T050 (UML), T051 (marcadores), T052 (persona/sistema), T149 (contenedor), T150 (componente/límite)

# F4 – exportadores en paralelo (tras T055 + T059)
T061 (draw.io), T062 (Excalidraw)

# F6 – contract tests en paralelo (tras T159)
T084, T085, T086, T087, T088, T089, T158

# F5 – tools MCP en paralelo (tras T073 + T074 y su contract test)
T075, T076, T077, T078, T079, T080, T157

# F8 – nodos en paralelo (tras T109)
T110, T111, T112, T114
```

## Implementation Strategy

1. **MVP (US1)**: F1 → F2 → F3 → F4 (sin T058, T060–T062, T154, T066) → T159, T084, T089 →
   F5 (T156, T068–T070, T072–T075, T081, T083, T160) → F7 (con T161) → F8 (nodos UML, edge,
   canvas) → F9 (T165, T125–T129) → T135–T137. T134 queda fuera del MVP.
   Validar con un agente real antes de seguir.
2. **US2**: formas y nodos C4, leyenda, contract C4, T138.
3. **US3**: operaciones, layout incremental, tools de edición/lectura, T139.
4. **US4**: estilo sketch, edición manual, T140.
5. **US5**: exportadores, export tool/endpoint, T141, validación real en T145.
6. Cerrar con T166, T143, T167 y T144–T147.

## Notes

- Ninguna tarea de este archivo se ha ejecutado; no se ha escrito código.
- Cada cambio de golden file (T044) requiere revisión explícita en el PR.
- Commits semánticos por tarea o grupo lógico; rama `001-mcp-class-c4-diagrams`.
