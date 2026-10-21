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
| `CHARTSIA_MAX_REQUEST_BYTES` | `1048576` | Tamaño máximo de petición |
| `CHARTSIA_WEB_ORIGIN` | `http://127.0.0.1:5173` | Origen CORS de la app en desarrollo |

## Conectar agentes

- **Claude Code (HTTP)**:
  `claude mcp add --transport http chartsia http://127.0.0.1:3333/mcp`
- **Claude Desktop (stdio)**: comando `pnpm --filter @chartsia/api exec chartsia-mcp`
  (puente stdio → hub; el hub debe estar corriendo). Variables: `CHARTSIA_URL`, `CHARTSIA_TOKEN`.
- **OpenCode**: en `opencode.json` (proyecto) bajo `mcp`; la pantalla de configuración de la app
  muestra estos JSON con la URL real. Esquema: `https://opencode.ai/config.json`.
  - HTTP:
    ```json
    { "mcp": { "chartsia": { "type": "remote", "url": "http://127.0.0.1:3333/mcp" } } }
    ```
    Fuera de loopback añade `"headers": { "Authorization": "Bearer <CHARTSIA_TOKEN>" }`.
  - stdio (puente `chartsia-mcp`; el hub debe estar corriendo):
    ```json
    { "mcp": { "chartsia": { "type": "local",
      "command": ["pnpm", "--filter", "@chartsia/api", "exec", "chartsia-mcp"],
      "cwd": "<RUTA_AL_REPO_CHARTSIA>",
      "environment": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
    ```
    Fuera de loopback añade `"CHARTSIA_TOKEN": "<CHARTSIA_TOKEN>"` en `environment`.
  - No subas el token real al repositorio: usa un `opencode.json` local o ignorado por git.
  - Comprueba la conexión con `opencode mcp list`.
- **Gemini CLI**: en `.gemini/settings.json` del proyecto (mejor que el global `~/.gemini/settings.json`)
  bajo `mcpServers`; la pantalla de configuración de la app muestra estos JSON con la URL real.
  - HTTP:
    ```json
    { "mcpServers": { "chartsia": { "httpUrl": "http://127.0.0.1:3333/mcp" } } }
    ```
    Fuera de loopback añade `"headers": { "Authorization": "Bearer <CHARTSIA_TOKEN>" }`.
  - stdio (puente `chartsia-mcp`; el hub debe estar corriendo y el repositorio compilado con `pnpm build`):
    ```json
    { "mcpServers": { "chartsia": { "command": "node",
      "args": ["apps/api/dist/stdio-bridge.js"],
      "cwd": "<RUTA_AL_REPO_CHARTSIA>",
      "env": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
    ```
    Fuera de loopback añade `"CHARTSIA_TOKEN": "<CHARTSIA_TOKEN>"` en `env`.
  - No subas el token real al repositorio: usa un `.gemini/settings.json` local o ignorado por git.
  - Comprueba la conexión con `gemini mcp list`.
- **GitHub Copilot (VS Code)**: en `.vscode/mcp.json` del proyecto, bajo `servers`; la pantalla de
  configuración de la app muestra estos JSON con la URL real.
  - HTTP:
    ```json
    { "servers": { "chartsia": { "type": "http", "url": "http://127.0.0.1:3333/mcp" } } }
    ```
  - stdio (puente `chartsia-mcp`; el hub debe estar corriendo y el repositorio compilado con `pnpm build`):
    ```json
    { "servers": { "chartsia": { "type": "stdio", "command": "node",
      "args": ["apps/api/dist/stdio-bridge.js"],
      "cwd": "<RUTA_AL_REPO_CHARTSIA>",
      "env": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
    ```
  - Fuera de loopback el token se pide con `inputs`, así no queda en el archivo: añade
    `"inputs": [{ "type": "promptString", "id": "chartsia-token", "description": "Token de ChartsIA", "password": true }]`
    y `"headers": { "Authorization": "Bearer ${input:chartsia-token}" }` (HTTP) o
    `"CHARTSIA_TOKEN": "${input:chartsia-token}"` en `env` (stdio).
  - Abre el chat de Copilot en modo Agent y habilita las herramientas de chartsia (selector de herramientas).
  - Alternativa por terminal (perfil de usuario, no del proyecto):
    `code --add-mcp '{"name":"chartsia","type":"http","url":"http://127.0.0.1:3333/mcp"}'`.
- **OpenAI Responses API**: herramienta
  `{"type":"mcp","server_label":"chartsia","server_url":"https://<túnel>/mcp","authorization":"<CHARTSIA_TOKEN>"}`;
  el hub debe ser accesible desde internet (p. ej. un túnel) con `CHARTSIA_HOST=0.0.0.0`.
- **Grok (API de xAI)**: herramienta MCP remota en `tools` de `POST https://api.x.ai/v1/responses`
  (campos de xAI: `type`, `server_url`, `server_label`, `headers`, opcionalmente `allowed_tools`;
  solo HTTP en streaming o SSE). La pantalla de configuración muestra este JSON.
  ```json
  { "type": "mcp", "server_label": "chartsia", "server_url": "https://<túnel>/mcp",
    "headers": { "Authorization": "Bearer <CHARTSIA_TOKEN>" } }
  ```
  - xAI conecta desde sus servidores: no llega a `127.0.0.1`, hace falta un túnel. Ejemplo:
    `CHARTSIA_HOST=0.0.0.0 CHARTSIA_TOKEN=<CHARTSIA_TOKEN> pnpm --filter @chartsia/api start` y, en
    otra terminal, `cloudflared tunnel --url http://127.0.0.1:3333` (la URL pública + `/mcp` es `server_url`).
    Fuera de loopback el token es obligatorio; si no defines `CHARTSIA_TOKEN`, el hub genera uno
    y lo guarda en `CHARTSIA_DATA_DIR/.token`.
  - Se usa `headers` y no `authorization` porque la doc de xAI no aclara si este campo añade `Bearer`,
    y el hub exige `Authorization: Bearer <token>`.
  - Ejemplo mínimo:
    ```bash
    curl https://api.x.ai/v1/responses -H "Authorization: Bearer $XAI_API_KEY" \
      -H "Content-Type: application/json" -d '{"model":"<modelo>","input":"Crea un diagrama de clases",
      "tools":[{"type":"mcp","server_label":"chartsia","server_url":"https://<túnel>/mcp",
      "headers":{"Authorization":"Bearer <CHARTSIA_TOKEN>"}}]}'
    ```
  - **Riesgo**: quien tenga la URL del túnel y el token puede crear y borrar diagramas (sin token,
    cualquiera con la URL). No subas el token al repositorio, usa uno largo y cierra el túnel al terminar.
  - Los esquemas de las herramientas usan `anyOf`, `const`, `pattern` y `additionalProperties:false`,
    que la doc de xAI admite en esquemas de herramientas; si xAI responde 400, indica la herramienta.

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
