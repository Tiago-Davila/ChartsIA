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


## Conectar agentes

La pantalla `/config` de la app muestra, junto al comando de cada agente, un prompt de instalación para pegarlo en el propio agente, que se conecta solo al hub.

- **Claude Code (HTTP)**: `--scope user` la deja disponible en todas las carpetas (se guarda en `~/.claude.json`):
  `claude mcp add --transport http --scope user chartsia http://127.0.0.1:3333/mcp`
  Sin `--scope user` queda solo en la carpeta donde se ejecuta (`local`).
- **Claude Desktop (stdio)**: es global por usuario. Añade a `claude_desktop_config.json`
  (macOS: `~/Library/Application Support/Claude/`; Windows: `%APPDATA%\Claude\`), tras `pnpm build`,
  un servidor con la ruta absoluta al puente y reinicia la app:
  ```json
  { "mcpServers": { "chartsia": { "command": "node",
    "args": ["<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js"],
    "env": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
  ```
  El hub debe estar corriendo.
- **Codex CLI**: queda en `~/.codex/config.toml`, disponible en todas las carpetas:
  `codex mcp add chartsia --url http://127.0.0.1:3333/mcp`
- **Grok Build**: queda en `~/.grok/config.toml`, disponible en todas las carpetas:
  `grok mcp add --transport http chartsia http://127.0.0.1:3333/mcp`
- **OpenCode**: en `~/.config/opencode/opencode.json` (global, todos los proyectos) o en `opencode.json`
  del proyecto, bajo `mcp`; la pantalla de configuración de la app muestra estos JSON con la URL real.
  Esquema: `https://opencode.ai/config.json`.
  - HTTP (OpenCode llama `remote` a cualquier servidor HTTP, aunque corra en tu máquina):
    ```json
    { "mcp": { "chartsia": { "type": "remote", "url": "http://127.0.0.1:3333/mcp" } } }
    ```
  - stdio (puente `chartsia-mcp`, tras `pnpm build`; el hub debe estar corriendo):
    ```json
    { "mcp": { "chartsia": { "type": "local",
      "command": ["node", "<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js"],
      "environment": { "CHARTSIA_URL": "http://127.0.0.1:3333/mcp" } } } }
    ```
  - Comprueba la conexión con `opencode mcp list`.

Los agentes corren en la misma máquina que el hub, así que ninguno necesita token.

Herramientas: `create_diagram`, `apply_changes`, `get_diagram`, `list_diagrams`,
`open_diagram`, `export_diagram`. Recursos: `chartsia://diagrams/{id}`,
`chartsia://diagrams/{id}/export.{ext}` y `chartsia://schema/{type}` (guía por tipo de diagrama).
Contrato completo en [specs/001-mcp-class-c4-diagrams/contracts](specs/001-mcp-class-c4-diagrams/contracts).


[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
