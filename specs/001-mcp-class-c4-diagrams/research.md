# Research: Diagramas de clases y C4 vía MCP

**Feature**: `001-mcp-class-c4-diagrams` | **Date**: 2026-10-19

Versiones verificadas en npm el 2026-10-19. Base: `docs/research/drawio-excalidraw.md`.

## R1. Integración MCP en Nest.js

- **Decision**: usar el SDK oficial `@modelcontextprotocol/sdk` 1.32.x directamente, envuelto en
  un `McpModule` propio de Nest. `McpServer` + `StreamableHTTPServerTransport` (modo stateless,
  un servidor/transporte por petición) montado en `POST/GET/DELETE /mcp` de un controller Nest.
- **Rationale**: es el SDK que exige la constitución; estable. `@rekog/mcp-nest` 2.x depende de
  los paquetes `@modelcontextprotocol/*` 2.0.0-beta, inaceptable para una base nueva.
- **Alternatives**: `@rekog/mcp-nest` (beta transitiva); servidor MCP separado fuera de Nest
  (duplica wiring de servicios y persistencia).

## R2. stdio sin dividir el estado

- **Decision**: un único proceso hub (Nest) es dueño del estado. Para clientes stdio (Claude
  Desktop/Code) se publica un binario puente `chartsia-mcp` que expone stdio y reenvía cada
  mensaje al `/mcp` HTTP del hub (`StdioServerTransport` ↔ `StreamableHTTPClientTransport`).
- **Rationale**: si el cliente lanzara su propio servidor stdio, la app no vería sus cambios
  (FR-021). Con el puente, stdio y HTTP comparten diagramas y tiempo real.
- **Alternatives**: base de datos compartida entre procesos + polling (latencia y
  concurrencia peores); solo HTTP (Claude Desktop sin config remota quedaría fuera).

## R3. Compatibilidad Claude + OpenAI

- **Decision**: esquemas de herramientas generados desde Zod 4 (`z.toJSONSchema`) restringidos
  a un subconjunto común: objetos con `additionalProperties: false`, uniones discriminadas
  como `anyOf` (nunca `oneOf`), sin `$ref` recursivos, sin `format`, enums como string.
  Resultados con `structuredContent` + `content` de texto resumido (los clientes que ignoran
  `structuredContent` siguen teniendo información útil).
- **Rationale**: OpenAI Responses API (remote MCP) y Apps SDK, y Claude (connector/Desktop)
  aceptan ese subconjunto. Principio I prohíbe lógica por proveedor.
- **Alternatives**: esquemas distintos por cliente (viola principio I).

## R4. Autenticación en red

- **Decision**: si el hub escucha en una interfaz que no es loopback, exige
  `Authorization: Bearer <CHARTSIA_TOKEN>` en `/mcp` y en la API/WS. El token se genera al
  primer arranque si no existe y se muestra una vez, junto con la URL de la app
  `…/#token=<token>`; la app lo lee del fragmento (no llega al servidor) y lo envía como
  header en REST y como `auth.token` en el handshake de Socket.IO. No se aceptan tokens en
  query params. Los logs redactan el header.
- **Rationale**: FR-030. Responses API permite enviar el header (`authorization`/`headers`).
- **Limitación conocida**: los conectores de la UI de ChatGPT exigen OAuth o "sin auth"; OAuth
  queda fuera de alcance de esta feature (documentado en quickstart).

## R5. Lienzo: React Flow

- **Decision**: React 19 + Vite + `@xyflow/react` 12.x. Nodos personalizados por tipo
  (`umlClass`, `umlInterface`, `umlEnum`, `c4Person`, `c4System`, `c4Container`,
  `c4Component`, `boundary`/`package` como nodos grupo con `parentId`). Aristas
  personalizadas que dibujan la polilínea de ELK y marcadores SVG UML propios.
- **Rationale**: pedido explícito; da pan/zoom infinito, minimapa, `fitView` (FR-022) y
  sub-flows para agrupaciones.
- **Alternatives**: embeber Excalidraw o draw.io (pierden el modelo semántico, principio II).

## R6. Formas y estilos "de los dos repos"

- **Decision**: un registro de formas en `packages/core/src/shapes` que define cada forma como
  geometría declarativa (lista de primitivas: rect, path, ellipse, line, text slots). Dos
  renderizadores la consumen:
  - estilo **clean**: SVG nítido, geometría y paleta inspiradas en `mxUML25`/`mxC4` de draw.io
    (clase en 3 compartimentos, persona C4 cabeza+cuerpo, contenedor BD como cilindro, cola
    como cilindro horizontal, límite punteado, paleta C4 azul #08427B/#1168BD/#438DD5/#85BBF0,
    externos #999999).
  - estilo **sketch**: las mismas primitivas pasadas por `roughjs` 4.6 (como Excalidraw), semilla
    derivada del hash del id del elemento para que sea determinista; fuente Excalifont (OFL).
- El exportador SVG del servidor usa el mismo registro, así la exportación coincide con la app.
- **Rationale**: una sola fuente de geometría para web y export; cumple FR-024 y SC de
  coincidencia visual. Apache-2.0 (draw.io) y MIT (Excalidraw) permiten inspiración/reuso con
  atribución en `THIRD_PARTY_NOTICES.md`.

## R7. Layout determinista e incremental

- **Decision**: `elkjs` 0.12 en el servidor, algoritmo `layered`, `edgeRouting: ORTHOGONAL`,
  `hierarchyHandling: INCLUDE_CHILDREN` (paquetes/límites), orden de entrada estable (nodos y
  aristas ordenados por id), `randomSeed` fijo. Tamaños de nodo calculados por el registro de
  formas con métricas de texto de tabla fija (no del navegador) para ser deterministas en Node.
  - Creación: layout completo.
  - Edición incremental: los nodos existentes y los fijados a mano (`pinned`) conservan su
    posición; solo se colocan los nuevos con ELK en modo interactivo
    (`layering.strategy: INTERACTIVE`, `crossingMinimization.semiInteractive: true`) sembrado
    con las posiciones previas, seguido de una pasada de eliminación de solapes que solo mueve
    nodos no fijados. Las aristas afectadas se re-enrutan.
- **Rationale**: FR-018/019/020, principio III.
- **Alternatives**: dagre (sin compound nodes ni enrutado ortogonal); layout en el cliente
  (no determinista entre navegadores y no disponible para export sin app).

## R8. Tiempo real app ↔ hub

- **Decision**: Socket.IO vía `@nestjs/platform-socket.io` 12.x. El hub emite
  `diagram.updated {diagramId, revision, diagram}` tras cada operación aplicada (agente o app).
  La app envía cambios manuales por la misma API de operaciones (REST `POST
  /api/diagrams/:id/operations`), así hay una sola ruta de escritura.
- **Concurrencia**: cola serial por diagrama (mutex en memoria); cada operación incrementa
  `revision`; "último cambio gana". Al reconectar, la app pide el diagrama y compara revision.
- **Alternatives**: SSE (unidireccional, suficiente pero sin rooms/reconexión listos); CRDT
  (Yjs) innecesario para un solo usuario (YAGNI).

## R9. Persistencia

- **Decision**: un archivo JSON por diagrama en `CHARTSIA_DATA_DIR` (por defecto
  `~/.chartsia/diagrams`), escritura atómica (tmp + rename), `index.json` reconstruible (si se
  reconstruye, el diagrama activo pasa a ser el de `updatedAt` más reciente). Fuera de
  desarrollo, el mismo hub sirve la app compilada (`apps/web/dist`), así `viewUrl` funciona
  con un solo proceso.
- **Rationale**: un usuario local, sin consultas complejas; cero dependencias nativas; los
  archivos son legibles y versionables. Principio VI (YAGNI).
- **Alternatives**: SQLite (`node:sqlite`/better-sqlite3) — innecesario para la escala.

## R10. Exportadores

- **draw.io**: `<mxfile><diagram><mxGraphModel>` sin comprimir. Clases como `swimlane` con
  `childLayout=stackLayout` y celdas hijas por atributo/operación (estilo de la paleta UML de
  draw.io); C4 con estilos `shape=mxgraph.c4.person2` y `UserObject` con `c4Name`, `c4Type`,
  `c4Description`, `c4Technology` como la librería C4 de draw.io. Aristas con `source`/`target`
  y `endArrow` según tipo UML (block/endFill=0 herencia, diamondThin endFill=1 composición…),
  puntos de ELK como `mxPoint`. Generado con un escritor XML que escapa todo texto.
- **Excalidraw**: JSON `{type:"excalidraw", version:2, source, elements, appState, files:{}}`
  generado directamente (sin dependencia de `@excalidraw/element`): formas como `rectangle`/
  `ellipse`, texto con `containerId` y `boundElements`, flechas con `startBinding`/`endBinding`
  y `points` de ELK; `seed`/`versionNonce` derivados del id (determinista), `index` fraccional
  generado en orden.
- **SVG**: renderizador del registro de formas (R6) en Node, saneado.
- Verificación: golden files + test que abre cada export en la herramienta real
  (`quickstart.md`, paso manual + Playwright opcional contra excalidraw.com/app.diagrams.net).

## R11. Testing

- **Decision**: Vitest 5 en todo el monorepo (`unplugin-swc` en `apps/api` para metadatos de
  decoradores de Nest), Testing Library para componentes, Playwright para un e2e de tiempo real.
  Contract tests de herramientas con el `Client` del SDK MCP sobre `InMemoryTransport` y sobre
  HTTP real; golden files en `packages/core/test/golden/`.
- **Rationale**: principio V.

## R12. Monorepo

- **Decision**: pnpm workspaces (pnpm 11 disponible), Node 24 LTS, TypeScript estricto.
  `packages/core` (dominio puro, sin frameworks), `apps/api` (Nest), `apps/web` (React).
- **Rationale**: core reutilizable por API, web (formas) y tests; separa dominio de transporte.
