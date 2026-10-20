# Quickstart / validación: Diagramas de clases y C4 vía MCP

Guía para comprobar la feature de punta a punta. Contratos en [contracts/](./contracts/),
modelo en [data-model.md](./data-model.md).

## Prerrequisitos

- Node.js 24 LTS y pnpm 11.
- Un agente MCP: Claude Code / Claude Desktop y/o OpenAI (Responses API o ChatGPT developer mode).

## Arranque

```bash
pnpm install
pnpm dev            # hub Nest en http://127.0.0.1:3333 y app en http://127.0.0.1:5173
```

Variables útiles: `CHARTSIA_PORT`, `CHARTSIA_HOST` (no loopback ⇒ exige token),
`CHARTSIA_TOKEN`, `CHARTSIA_PUBLIC_URL`, `CHARTSIA_DATA_DIR`, `CHARTSIA_MAX_ELEMENTS`.

Fuera de desarrollo: `pnpm build && pnpm --filter @chartsia/api start`; el hub sirve también la
app en `CHARTSIA_PUBLIC_URL`. Con host no loopback, abrir la URL `…/#token=<token>` que el hub
imprime al arrancar (ver [app-api.md](./contracts/app-api.md)).

## Conectar agentes

- **Claude Code (HTTP)**: `claude mcp add --transport http chartsia http://127.0.0.1:3333/mcp`
- **Claude Desktop / stdio**: comando `pnpm --filter @chartsia/api exec chartsia-mcp`
  (puente stdio → hub; el hub debe estar corriendo).
- **OpenAI Responses API**: herramienta `{"type":"mcp","server_label":"chartsia",
  "server_url":"https://<túnel>/mcp","authorization":"<CHARTSIA_TOKEN>"}`; el hub debe estar
  expuesto públicamente (p. ej. túnel) con `CHARTSIA_HOST=0.0.0.0`.
- **ChatGPT UI**: requiere OAuth o servidor sin auth; fuera de alcance (ver research R4).

## Escenarios de validación

| # | Historia | Paso | Resultado esperado |
|---|----------|------|--------------------|
| 1 | US1 | Con la app abierta, pedir al agente "diagrama de clases de una biblioteca con Libro, Autor, Socio, Préstamo" | aparece en < 2 s, sin solapes, compartimentos y visibilidad visibles |
| 2 | US1 | Pedir el mismo diagrama otra vez en un diagrama nuevo | layout idéntico (comparar `get_diagram includeLayout`) |
| 3 | US1 | Pedir al agente una herencia hacia una clase inexistente | el agente recibe `UNKNOWN_REFERENCE` con hint y lo corrige en el siguiente turno |
| 4 | US2 | "C4 de contenedores de una tienda online: web, API, BD, pasarela de pagos externa" | límite con contenedores dentro, externo fuera, BD como cilindro, etiquetas "desc [tech]", leyenda |
| 5 | US3 | "Añade Editorial relacionada con Libro", luego "renombra Socio a Usuario", luego "elimina Préstamo" | cada cambio aparece en vivo; el resto no se mueve; relaciones de Préstamo desaparecen |
| 6 | US4 | Mover un nodo a mano, pedir al agente que añada otro elemento | el nodo movido conserva su posición; `get_diagram` refleja el movimiento |
| 7 | US4 | Alternar estilo clean/sketch, recargar | contenido igual, estilo persiste |
| 8 | US5 | Exportar a drawio y excalidraw; abrir en app.diagrams.net y excalidraw.com | abren sin errores con todos los elementos y flechas conectadas |
| 9 | SC-004 | Repetir 1, 5 y 8 con un agente GPT | mismo resultado |
| 10 | Seguridad | Crear una clase llamada `<img src=x onerror=alert(1)>` | se muestra como texto literal en app y en SVG exportado |

## Comandos de verificación automática

```bash
pnpm test                 # unit + contract + golden (todos los paquetes)
pnpm --filter @chartsia/core test:golden   # regenerar solo con revisión explícita: -u
pnpm --filter @chartsia/web test:e2e       # Playwright: agente simulado → app en vivo
pnpm typecheck && pnpm lint
```
