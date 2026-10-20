# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ChartsIA dibuja diagramas de clases UML y C4 a pedido de agentes de IA (Claude y GPT) vía MCP.
El diagrama aparece en vivo en un lienzo React Flow, donde se edita a mano o se exporta a SVG,
draw.io o Excalidraw. Todo el código, los comentarios y la documentación están en español.

## Reglas de trabajo

- **Commits**: convencionales y en español (`feat(web): …`, `fix(core): …`, `test(api): …`).
  **Sin** línea `Co-Authored-By` ni ninguna otra atribución.
  **Con** `Closes #`para cerrar el issue correspondiente si se lo pide. 
- **Pull requests**: sin mencionar a Claude Code (nada de "Generated with Claude Code").
- **Ramas**: cada función, módulo o fix nuevo que no exista ya en una rama va en una rama
  nueva, creada antes de empezar a trabajar.
- **Código**: legible, simple y fácil de entender. Es mejor una solución directa que una abstracción.
- **Comentarios**: en español y simples. Una sola oración arriba de la función o método, nada más.
- **Specs**: no todo cambio pasa por spec-kit (`specs/`, `.specify/`). Pregunta antes de
  crear o actualizar specs, planes o tareas.
- **Errores detectados**: si encuentras un bug fuera del alcance de la tarea, pregunta si
  hay que abrir un issue.
- **Dependencias**: no agregues dependencias que se pueden resolver con poco código propio.
  Pregunta siempre antes de agregar una.

## Comandos

Node 24 y pnpm 11 (monorepo pnpm: `packages/*`, `apps/*`).

```bash
pnpm install
pnpm dev                                    # hub en :3333 y app Vite en :5173
pnpm build && pnpm --filter @chartsia/api start   # un proceso: el hub sirve la app compilada
pnpm test                                   # tests de core, api y web
pnpm typecheck && pnpm lint
pnpm --filter @chartsia/web test:e2e        # Playwright (compila y levanta el hub real en :3390)
pnpm --filter @chartsia/core test:golden -u # regenerar golden files; revisar siempre el diff
```

Un solo test: `pnpm --filter @chartsia/<core|api|web> exec vitest run <ruta-o-patrón> -t "<nombre>"`.
En `apps/api`, `pnpm test` también corre los tests de rendimiento (`*.perf.test.ts`) en serie.

Los tests y Vite resuelven `@chartsia/core` desde sus fuentes mediante la condición de export
`@chartsia/source`, así que no hace falta compilar el core para testear. Sí hace falta para
`pnpm dev` y producción, porque el api corre sobre `dist/`. `pnpm dev` ya compila el core al
arrancar; si cambias el core con el dev corriendo, recompílalo.

## Arquitectura

Tres paquetes con dependencia en una sola dirección: `web` → `core` ← `api`.

- **`packages/core`**: dominio puro, sin frameworks. Se importa por subrutas
  (`@chartsia/core/model`, `/validation`, `/operations`, `/layout`, `/shapes`, `/render`, `/export`).
  - `model`: esquemas Zod del diagrama, elementos, relaciones y operaciones. Son la fuente de
    los JSON Schema de las herramientas MCP (subconjunto común Claude/OpenAI, `strictObject`).
  - `validation`: reglas de dominio que devuelven errores con `code`, `path` (JSON Pointer),
    `message` y `hint`, para que el agente se corrija solo.
  - `operations/apply.ts`: aplica lotes atómicos de operaciones (`add_element`,
    `move_element`, `set_title`…). Devuelve todo o nada.
  - `layout`: ELK más un enrutado ortogonal propio. Es determinista (misma entrada, misma
    salida byte a byte) y el layout incremental no mueve elementos no afectados ni los fijados (`pinned`).
  - `shapes`: geometría de cada forma como `Primitive[]`. La misma geometría la dibujan la
    app y el SVG exportado. `text-metrics.ts` mide con tablas fijas de anchos de glifo, no
    con el navegador.
  - `render/scene.ts` y `export/*`: SVG, draw.io y Excalidraw. Cada exportador tiene golden
    files en `test/golden/expected`.
- **`apps/api`**: hub Nest.js. `DiagramCommandService` es la **única ruta de escritura** para
  MCP y para la app: valida, hace el layout, persiste (JSON con escritura atómica en
  `CHARTSIA_DATA_DIR`) y emite eventos. Los adaptadores son delgados: herramientas MCP en
  `mcp/tools` (Streamable HTTP en `/mcp`, más el puente stdio `stdio-bridge.ts`), REST en
  `diagrams/*.controller.ts` y Socket.IO en `live/` (envía `diagram.updated` con `origin`
  `agent`/`app`). El token Bearer solo se exige fuera de loopback (`auth/`, `common/host-check.ts`).
- **`apps/web`**: React + React Flow + store propio (`state/diagram-store.ts`).
  `use-hub-sync` mantiene el diagrama sincronizado con el hub, `to-react-flow` lo convierte
  en nodos y aristas, y `use-diagram-edits` manda las ediciones manuales como operaciones al
  mismo endpoint que usa el agente.

Toda capacidad nueva debe existir en el núcleo y exponerse como herramienta MCP; la app es
otro cliente más (`.specify/memory/constitution.md`, principio I). Cambiar la salida de un
exportador exige actualizar y revisar sus golden files. El contrato MCP está en
`specs/001-mcp-class-c4-diagrams/contracts/`.


## Ramas Importantes y sus reglas
Las ramas mas importantes son **develop** y **master**, SIEMPRE se tiene que hacer push de una rama fix, refactor, feature, docs, etc a develop, de ahi merge a main.


