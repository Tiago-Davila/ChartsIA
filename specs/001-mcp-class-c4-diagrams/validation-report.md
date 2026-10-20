# Informe de validación: Diagramas de clases y C4 vía MCP

**Feature**: `001-mcp-class-c4-diagrams` | **Fecha**: 2026-10-20 | **Rama**: `001-mcp-class-c4-diagrams`

## 1. Verificación automática (T147)

`pnpm typecheck && pnpm lint && pnpm test` y `pnpm --filter @chartsia/web test:e2e`:

| Suite | Resultado |
|-------|-----------|
| Typecheck (3 paquetes) | sin errores |
| ESLint | sin errores |
| `@chartsia/core` (unit + golden) | 188/188 ✅ |
| `@chartsia/api` (unit, contract InMemory/HTTP/stdio, integración) | 124/124 ✅ |
| `@chartsia/api` rendimiento (aislado) | 2/2 ✅ |
| `@chartsia/web` (componentes, mapeo, store) | 48/48 ✅ |
| `@chartsia/web` E2E Playwright (hub real + app compilada) | 15/15 ✅ |

## 2. Escenarios del quickstart

| # | Escenario | Cobertura | Resultado |
|---|-----------|-----------|-----------|
| 1 | Clases vía agente, < 2 s, sin solapes | E2E `us1-class-diagram` (agente simulado por MCP HTTP) | ✅ visible en ~0,2–0,9 s; sin solapes de nodos ni aristas que crucen nodos |
| 2 | Mismo diagrama ⇒ mismo layout | E2E `us1-class-diagram`, contract `create_diagram`, unit layout, golden | ✅ idéntico byte a byte |
| 3 | `UNKNOWN_REFERENCE` y corrección | E2E `us1-validation-error` (corrección guionada), contract tests | ✅ error con path y hint; la app no cambia hasta el lote corregido |
| 4 | C4 contenedores | E2E `us2-c4-container`, contract C4 | ✅ límite, cilindro, `[Container: tech]`, etiquetas, leyenda |
| 5 | Tres refinamientos en vivo | E2E `us3-refine` | ✅ cambios en vivo; Libro y Autor no se mueven |
| 6 | Movimiento manual se conserva | E2E `us4-manual-edit` | ✅ `pinned` y posición intacta tras añadido del agente |
| 7 | Estilo persiste tras recargar | E2E `us4-manual-edit` | ✅ |
| 8 | Exportar draw.io / Excalidraw | E2E `us5-export` (estructura y bindings), golden | ✅ automatizable; ⏳ apertura en app.diagrams.net y excalidraw.com pendiente (T145) |
| 9 | Paridad con GPT | — | ⏳ pendiente (T145) |
| 10 | XSS en nombres | E2E `security-xss`, unit escaping | ✅ texto literal en app y SVG; ningún diálogo |

## 3. Criterios de éxito

| Criterio | Evidencia | Estado |
|----------|-----------|--------|
| SC-001 (< 2 s, ≤ 30 elementos) | E2E: ~0,2–0,9 s de la llamada MCP a la app; hub: `create_diagram` de 30 elementos < 500 ms | ✅ |
| SC-002 (≥ 95 % sin solapes) | Automático: 0 solapes en todos los tests de layout, contract y E2E; con agentes reales: `eval-prompts.md` sección A | ⏳ medición con agentes reales pendiente (T144) |
| SC-003 (≥ 90 % autocorrección) | Errores con code/path/message/hint verificados; medición con agentes reales: `eval-prompts.md` sección B | ⏳ pendiente (T144) |
| SC-004 (paridad Claude/GPT) | Mismo contrato MCP y subconjunto JSON Schema común verificado por contract test | ⏳ prueba con GPT pendiente (T145) |
| SC-005 (exports abren) | Estructura validada en E2E y golden | ⏳ apertura real pendiente (T145) |
| SC-006 (200 elementos fluidos) | E2E `perf-large-diagram`: pan y zoom ≥ 50 fps (Chromium headless, sin trazas) | ✅ |
| SC-007 (novato < 3 min) | Métrica de resultado, fuera del cómputo automático | — |

## 4. Validación manual con agentes reales (T144, T145)

**Pendiente.** Requiere personas con Claude Code / Claude Desktop y una cuenta de OpenAI con
túnel público; no se puede ejecutar desde el entorno de implementación. Procedimiento:

1. `pnpm build && pnpm --filter @chartsia/api start` (o `pnpm dev`).
2. Claude Code: `claude mcp add --transport http chartsia http://127.0.0.1:3333/mcp`.
   Claude Desktop: comando `pnpm --filter @chartsia/api exec chartsia-mcp`.
3. Ejecutar los escenarios 1, 3, 4, 5 y 8 y las 30 peticiones de [eval-prompts.md](./eval-prompts.md);
   anotar por petición: aceptada / solapes / turnos hasta corregir.
4. GPT: hub con `CHARTSIA_HOST=0.0.0.0`, túnel HTTPS y herramienta `mcp` de la Responses API con
   `authorization`. Repetir escenarios 1, 5 y 8 y `eval-prompts.md`.
5. Abrir los `.drawio` en app.diagrams.net y los `.excalidraw` en excalidraw.com.

| Agente | SC-002 (A, n/20) | SC-003 (B, n/10) | Escenarios 1/3/4/5/8 | Exports abren |
|--------|------------------|------------------|----------------------|---------------|
| Claude Code (HTTP) | — | — | — | — |
| Claude Desktop (stdio) | — | — | — | — |
| GPT (Responses API) | — | — | — | — |

## 5. Constitution Check final (principios I–VI)

| Principio | Verificación | Estado |
|-----------|--------------|--------|
| I. MCP-First, agnóstico | 6 tools, incluida `open_diagram` (equivalente MCP de `activate`); la app escribe por el mismo servicio de comandos; `resource_link` al SVG renderizado; Streamable HTTP y stdio probados | ✅ |
| II. Modelo semántico canónico | `packages/core/model` sin estilos de formato externo; SVG, draw.io y Excalidraw son exportadores | ✅ |
| III. Declarativo + layout determinista | Coordenadas opcionales (fijan el elemento); determinismo byte a byte en unit, golden, contract y E2E | ✅ |
| IV. Validación y errores accionables | Códigos estables, JSON Pointer y hint; lotes atómicos; 12 códigos alcanzables probados | ✅ |
| V. Test-First | Tests de reglas y contract tests escritos antes de la implementación (dependencia explícita); golden por exportador; E2E por transporte (HTTP, stdio, REST y WS) | ✅ |
| VI. Simplicidad y seguridad | JSON en disco; texto escapado (React, SVG, XML sin DOCTYPE/entidades, draw.io con `html=0`); límites de 1 MiB y 500 elementos; token fuera de loopback con redacción en logs; Host check en loopback; esquema MCP versionado 1.0.0 | ✅ |

## 6. Desviaciones respecto al plan

- **TypeScript 6.0** en lugar de 5.x: es la versión más reciente compatible con typescript-eslint
  (`<6.1`) y Nest CLI 12; TypeScript 7 rompe el lint.
- **Rutas de aristas**: ELK coloca los nodos y un enrutador ortogonal propio (A* sobre rejilla
  de visibilidad) traza las rutas, para que sigan evitando nodos tras fijar o mover elementos.
- **Condición de export `@chartsia/source`**: el núcleo se consume desde sus fuentes en
  desarrollo y tests; el nombre evita colisiones con paquetes de terceros que usan `source`.
- **Tests de rendimiento** del hub aislados (`*.perf.test.ts`) para que la carga en paralelo de
  otros tests no falsee la medida.
