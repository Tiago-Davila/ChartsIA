# ChartsIA

Diagramas de clases UML y C4 dibujados por agentes de IA. Pides el diagrama a Claude o GPT,
el agente llama a las herramientas MCP de ChartsIA y el diagrama aparece al instante en un
lienzo infinito (React Flow), donde puedes seguir editándolo a mano o exportarlo a SVG,
draw.io o Excalidraw.

- **MCP para Claude y GPT**: mismo contrato por Streamable HTTP (`/mcp`) y stdio
  (`chartsia-mcp`). Esquemas en el subconjunto JSON Schema común a ambos proveedores.
- **Diagramas**: clases (clase, interfaz, enum, paquete y las seis relaciones UML) y C4 de
  contexto, contenedores y componentes (persona, sistema, contenedor con variantes BD/cola/web,
  componente, límite y leyenda).
- **Layout automático y determinista** (ELK + enrutado ortogonal propio): sin solapes y con
  relaciones que no atraviesan elementos. Los cambios incrementales no mueven lo que ya estaba.
- **Errores accionables**: cada error trae `code`, `path` (JSON Pointer), `message` y `hint`
  para que el agente se corrija solo.
- **Exportación** a SVG, draw.io y Excalidraw (este último con trazo a mano alzada y Excalifont).

## Requisitos

- Node.js 24 LTS y pnpm 11.

## Instalación y arranque

```bash
pnpm install
pnpm dev            # hub en http://127.0.0.1:3333 y app en http://127.0.0.1:5173
```

Producción (un solo proceso: el hub sirve también la app compilada):

```bash
pnpm build
pnpm --filter @chartsia/api start      # app y MCP en http://127.0.0.1:3333
```

| Variable | Defecto | Uso |
|----------|---------|-----|
| `CHARTSIA_PORT` | `3333` | Puerto del hub |
| `CHARTSIA_HOST` | `127.0.0.1` | Interfaz; fuera de loopback se exige token |
| `CHARTSIA_TOKEN` | generado | Token de acceso fuera de loopback |
| `CHARTSIA_PUBLIC_URL` | `http://<host>:<port>` | Base de `viewUrl` y de las descargas |
| `CHARTSIA_DATA_DIR` | `~/.chartsia/diagrams` | Diagramas en JSON (escritura atómica) |
| `CHARTSIA_MAX_ELEMENTS` | `500` | Máximo de elementos por diagrama |
| `CHARTSIA_MAX_REQUEST_BYTES` | `8388608` | Tamaño máximo de petición |
| `CHARTSIA_WEB_ORIGIN` | `http://127.0.0.1:5173` | Origen CORS de la app en desarrollo |

Las imágenes se insertan como datos embebidos en el diagrama y se guardan en el JSON del hub; no se guardan rutas del equipo ni se descargan URLs remotas. Se aceptan PNG y JPG válidos y SVG con un subconjunto de primitivas y texto, sin scripts, enlaces ni estilos activos. El límite es 5 MiB por archivo, 25 MiB y 40 millones de píxeles raster por diagrama. El límite HTTP predeterminado de 8 MiB permite enviar una imagen de hasta 5 MiB codificada en base64; `CHARTSIA_MAX_REQUEST_BYTES` se puede ajustar para instalaciones que necesiten otro tamaño.

La app y la herramienta MCP `import_mermaid` importan `classDiagram` y `classDiagram-v2`, hasta 256 Ki caracteres. Se conservan clases, miembros, namespaces y relaciones; las directivas visuales se omiten con avisos. Los links, callbacks y la configuración incrustada nunca se ejecutan ni se consultan. La importación inválida no crea un diagrama y devuelve un error con la ruta `/source` y la línea cuando está disponible; las aproximaciones de relaciones incluyen un aviso.

## Conectar agentes

La pantalla `/config` de la app muestra, junto al comando de cada agente, un prompt de instalación para pegarlo en el propio agente, que se conecta solo al hub.

- **Claude Code (HTTP)**: `--scope user` la deja disponible en todas las carpetas (se guarda en `~/.claude.json`):
  `claude mcp add --transport http --scope user chartsia http://127.0.0.1:3333/mcp`
  Sin `--scope user` queda solo en la carpeta donde se ejecuta (`local`). Fuera de loopback añade
  `--header "Authorization: Bearer <CHARTSIA_TOKEN>"`.
- **Claude Desktop (stdio)**: es global por usuario. Añade a `claude_desktop_config.json`
  (macOS: `~/Library/Application Support/Claude/`; Windows: `%APPDATA%\Claude\`), tras `pnpm build`,
  un servidor con la ruta absoluta al puente y reinicia la app:
  ```json
  { "mcpServers": { "chartsia": { "command": "node",
    "args": ["<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js"],
    "env": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
  ```
  El hub debe estar corriendo. Fuera de loopback añade `"CHARTSIA_TOKEN": "<CHARTSIA_TOKEN>"` en `env`.
- **OpenCode**: en `~/.config/opencode/opencode.json` (global, todos los proyectos) o en `opencode.json`
  del proyecto, bajo `mcp`; la pantalla de configuración de la app muestra estos JSON con la URL real.
  Esquema: `https://opencode.ai/config.json`.
  - HTTP:
    ```json
    { "mcp": { "chartsia": { "type": "remote", "url": "http://127.0.0.1:3333/mcp" } } }
    ```
    Fuera de loopback añade `"headers": { "Authorization": "Bearer <CHARTSIA_TOKEN>" }`.
  - stdio (puente `chartsia-mcp`, tras `pnpm build`; el hub debe estar corriendo):
    ```json
    { "mcp": { "chartsia": { "type": "local",
      "command": ["node", "<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js"],
      "environment": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
    ```
    Fuera de loopback añade `"CHARTSIA_TOKEN": "<CHARTSIA_TOKEN>"` en `environment`.
  - No subas el token real al repositorio: usa un `opencode.json` local o ignorado por git.
  - Comprueba la conexión con `opencode mcp list`.
- **OpenAI Responses API**: no tiene configuración global; la herramienta va en el array `tools` de cada petición:
  `{"type":"mcp","server_label":"chartsia","server_url":"https://<túnel>/mcp","authorization":"<CHARTSIA_TOKEN>"}`;
  el hub debe ser accesible desde internet (p. ej. un túnel) con `CHARTSIA_HOST=0.0.0.0`.

Herramientas: `create_diagram`, `apply_changes`, `get_diagram`, `list_diagrams`,
`open_diagram`, `export_diagram`. Recursos: `chartsia://diagrams/{id}`,
`chartsia://diagrams/{id}/export.{ext}` y `chartsia://schema/{type}` (guía por tipo de diagrama).
Contrato completo en [specs/001-mcp-class-c4-diagrams/contracts](specs/001-mcp-class-c4-diagrams/contracts).

### Acceso desde la red

En loopback no hace falta token (y se rechazan cabeceras `Host` ajenas para evitar DNS
rebinding). Si el hub escucha en otra interfaz, exige `Authorization: Bearer <token>` en `/mcp`
y `/api`, y `auth.token` en el canal en vivo. Al arrancar muestra la URL de la app con el token
en el fragmento (`…/#token=<token>`): el fragmento no llega al servidor y la app lo guarda solo
para la pestaña. Si falta, la app pide el token.

### Limitación conocida: ChatGPT (interfaz web)

Los conectores de la interfaz de ChatGPT exigen OAuth o un servidor sin autenticación. ChartsIA
usa token Bearer, así que la conexión directa desde la interfaz de ChatGPT queda fuera de
alcance; usa la Responses API o los clientes de Claude.

## Desarrollo

```bash
pnpm test                                   # núcleo, hub (unit, contract, integración) y app
pnpm --filter @chartsia/core test:golden -u # regenerar golden files (solo con revisión del diff)
pnpm --filter @chartsia/web test:e2e        # Playwright: agente simulado → app en vivo
pnpm typecheck && pnpm lint
```

| Paquete | Contenido |
|---------|-----------|
| `packages/core` | Modelo canónico, validación, operaciones, formas, layout, render y exportadores (sin frameworks) |
| `apps/api` | Hub Nest.js: MCP, REST, Socket.IO, persistencia y puente stdio |
| `apps/web` | App React + React Flow |

El proceso de trabajo sigue spec-kit (`specs/`, `.specify/`). Atribuciones de terceros en
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
