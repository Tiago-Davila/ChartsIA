# Implementation Plan: Diagramas de clases y C4 generados por agentes vía MCP

**Branch**: `001-mcp-class-c4-diagrams` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mcp-class-c4-diagrams/spec.md`

## Summary

Un hub Nest.js expone herramientas MCP (`create_diagram`, `apply_changes`, `get_diagram`,
`list_diagrams`, `open_diagram`, `export_diagram`) por Streamable HTTP y, mediante un puente, por stdio, de
modo que Claude y GPT usan el mismo contrato. Los agentes envían descripciones estructurales
sin coordenadas obligatorias; un núcleo de dominio puro (`packages/core`) valida contra reglas UML/C4,
calcula el layout determinista con ELK y exporta a SVG, draw.io y Excalidraw. Una app React
con React Flow muestra el diagrama en un lienzo infinito, recibe los cambios en vivo por
WebSocket y permite editar a mano en dos estilos: limpio (formas de draw.io) y boceto
(roughjs, como Excalidraw). Decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x estricto, Node.js 24 LTS

**Primary Dependencies**: `@modelcontextprotocol/sdk` 1.32, Nest.js 12
(`@nestjs/platform-socket.io`), Zod 4, elkjs 0.12, React 19 + Vite 8, `@xyflow/react` 12,
roughjs 4.6, socket.io-client 4.8, zustand 5

**Storage**: archivos JSON por diagrama en `CHARTSIA_DATA_DIR` (escritura atómica)

**Testing**: Vitest 5 (+ `unplugin-swc` en Nest), Testing Library, Playwright (e2e en vivo),
`Client` del SDK MCP para contract tests, golden files

**Target Platform**: hub en Linux/macOS/Windows (Node 24); app en navegadores evergreen

**Project Type**: web application (monorepo pnpm: núcleo + API + frontend)

**Performance Goals**: diagrama de ≤30 elementos visible en la app en < 2 s desde la llamada
MCP (SC-001); layout de 200 elementos < 1 s en servidor; ≥ 50 fps sostenidos al hacer pan/zoom
con 200 nodos, medidos con trazas de Playwright (SC-006)

**Constraints**: salida determinista byte a byte; peticiones ≤ 1 MiB; ≤ 500 elementos por
diagrama; sin recursos remotos; textos siempre escapados

**Scale/Scope**: un usuario por instancia, decenas de diagramas, 2 familias de diagrama
(clases, C4 L1–L3), 6 herramientas MCP, 3 formatos de exportación

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el diseño | Estado |
|-----------|---------------------------|--------|
| I. MCP-First, agnóstico | Toda capacidad es herramienta MCP (incluido activar un diagrama, `open_diagram`); las tools que modifican devuelven un `resource_link` al SVG; la app usa el mismo `DiagramOperationsService`; esquema común Claude/OpenAI (R3); stdio + Streamable HTTP (R1, R2) | ✅ |
| II. Modelo semántico canónico | `packages/core/model` sin estilos ni coordenadas obligatorias; draw.io/Excalidraw/SVG son exportadores en el borde (R10) | ✅ |
| III. Declarativo + layout determinista | Posiciones opcionales (se respetan como `pinned`); ELK con orden estable y semilla fija; operaciones incrementales por id; pins respetados (R7) | ✅ |
| IV. Validación y errores accionables | Zod + reglas de dominio con códigos estables, JSON Pointer y hint; lotes atómicos ([data-model](./data-model.md)) | ✅ |
| V. Test-First | Contract tests por herramienta escritos antes de cada tool (dependencia explícita en tasks) (InMemory + HTTP + stdio), golden files por exportador, unit por regla, e2e por transporte (R11) | ✅ |
| VI. Simplicidad y seguridad | JSON en disco en vez de BD; sin CRDT; sin import; escape de texto en SVG/XML/React; XML sin entidades; límites; token fuera de loopback y redacción en logs (R4, R9) | ✅ |
| Restricciones técnicas | TS/Node LTS, SDK oficial MCP, elkjs; SVG + draw.io + Excalidraw | ✅ |
| Flujo | Rama `001-mcp-class-c4-diagrams` desde `develop`; spec → plan → tasks | ✅ |

Re-evaluación post-diseño (Phase 1): sin violaciones. El puente stdio es un punto de entrada
extra del mismo paquete `apps/api`, no un proyecto nuevo.

## Project Structure

### Documentation (this feature)

```text
specs/001-mcp-class-c4-diagrams/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mcp-tools.md
│   └── app-api.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
package.json, pnpm-workspace.yaml, tsconfig.base.json, THIRD_PARTY_NOTICES.md

packages/core/                     # @chartsia/core — dominio puro, sin frameworks
├── src/
│   ├── model/                     # esquemas Zod: diagram, elements, relations, operations, ids
│   ├── validation/                # reglas de dominio → ValidationError {code,path,message,hint}
│   ├── operations/                # aplicar lotes atómicos al modelo
│   ├── shapes/                    # registro de formas: geometría declarativa + medida de texto
│   │   ├── uml/                   # class, interface, enum, package, marcadores de relación
│   │   └── c4/                    # person, system, container(db/queue/web), component, boundary
│   ├── layout/                    # elkjs: layout completo e incremental, solapes, rutas ortogonales
│   ├── render/                    # primitivas → SVG (clean) y → roughjs (sketch)
│   └── export/                    # svg.ts, drawio.ts, excalidraw.ts, xml-escape.ts
└── test/
    ├── unit/                      # reglas, operaciones, layout determinista
    └── golden/                    # fixtures de entrada + .svg/.drawio/.excalidraw esperados

apps/api/                          # @chartsia/api — hub Nest.js
├── src/
│   ├── main.ts                    # bootstrap HTTP + WS
│   ├── stdio-bridge.ts            # bin `chartsia-mcp`: stdio ↔ /mcp
│   ├── config/                    # env, límites
│   ├── common/                    # logger con redacción, filtro de excepciones de dominio
│   ├── health/                    # GET /api/health
│   ├── auth/                      # gestión del token y guard Bearer (solo fuera de loopback)
│   ├── diagrams/                  # servicios de comandos y consultas, export, controllers /api
│   │   └── persistence/           # repositorio JSON, lock por diagrama
│   ├── mcp/                       # McpModule: controller /mcp, registro de tools y recursos
│   ├── live/                      # gateway Socket.IO, namespace /live
│   └── web/                       # sirve apps/web/dist fuera de desarrollo
└── test/
    ├── contract/                  # tools MCP vía InMemoryTransport, HTTP y stdio
    └── integration/               # REST + WS + persistencia

apps/web/                          # @chartsia/web — React + Vite + React Flow
├── src/
│   ├── app/                       # rutas (/, /d/:id), layout, lista, toolbar, avisos, token
│   ├── canvas/                    # ReactFlow, MiniMap, Controls, sync con store
│   ├── nodes/                     # UmlClassNode, UmlInterfaceNode, UmlEnumNode, C4*Node, GroupNode
│   ├── edges/                     # RoutedEdge (puntos ELK) + marcadores UML/C4
│   ├── render/                    # adaptadores del registro de formas (clean SVG / rough)
│   ├── state/                     # zustand store, cliente REST y Socket.IO
│   └── legend/                    # leyenda C4
└── test/
    ├── unit/                      # componentes de nodos y edges
    └── e2e/                       # Playwright: agente simulado → actualización en vivo
```

**Structure Decision**: monorepo pnpm con tres paquetes. `packages/core` concentra todo lo
que debe ser determinista y testeable sin red (modelo, validación, layout, formas,
exportadores) y lo comparten la API (validar, disponer, exportar) y la web (geometría de
formas), garantizando que app y SVG exportado coincidan. `apps/api` solo adapta transportes
(MCP, REST, WS) y persistencia. `apps/web` es un cliente más del núcleo (principio I).

## Complexity Tracking

Sin violaciones de la constitución que justificar.
