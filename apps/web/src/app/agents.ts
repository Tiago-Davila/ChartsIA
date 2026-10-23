export interface Agent {
  id: string;
  name: string;
  /** Instrucción corta de uso. */
  help: string;
  /** Comando o configuración que se copia. */
  snippet(mcpUrl: string): string;
}

/** Los hubs fuera de loopback exigen token; en loopback se omite. */
const esLoopback = (mcpUrl: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(mcpUrl).hostname);

/**
 * Agentes de la pantalla de configuración: para sumar una tarjeta basta añadir una entrada aquí.
 * Los comandos replican la sección "Conectar agentes" del README: mantenerlos sincronizados.
 */
export const AGENTS: Agent[] = [
  {
    id: 'claude-code',
    name: 'Claude Code (HTTP)',
    help: 'Ejecuta este comando en tu terminal. Con --scope user queda disponible en todas tus carpetas (se guarda en ~/.claude.json).',
    snippet: (mcpUrl) =>
      `claude mcp add --transport http --scope user chartsia ${mcpUrl}${esLoopback(mcpUrl) ? '' : ' --header "Authorization: Bearer <CHARTSIA_TOKEN>"'}`,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop (stdio)',
    help: 'Claude Desktop es global por usuario. Pega este bloque en claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/; Windows: %APPDATA%\\Claude\\), sustituye <RUTA_AL_REPO_CHARTSIA> (antes ejecuta "pnpm build"), reinicia Claude Desktop y deja el hub corriendo.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          mcpServers: {
            chartsia: {
              command: 'node',
              args: ['<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js'],
              env: { CHARTSIA_URL: mcpUrl, ...(esLoopback(mcpUrl) ? {} : { CHARTSIA_TOKEN: '<CHARTSIA_TOKEN>' }) },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'openai',
    name: 'OpenAI Responses API',
    help: 'No tiene configuración global ni carpetas: la herramienta va en cada petición, en el array "tools". El hub debe ser accesible desde internet y el token va en authorization.',
    snippet: (mcpUrl) => JSON.stringify({ type: 'mcp', server_label: 'chartsia', server_url: mcpUrl, authorization: '<CHARTSIA_TOKEN>' }),
  },
  {
    id: 'opencode-remote',
    name: 'OpenCode (HTTP)',
    help: 'Añádelo a "mcp" en ~/.config/opencode/opencode.json para todos tus proyectos, o en el opencode.json de un proyecto. Fuera de loopback, sustituye <CHARTSIA_TOKEN> y no lo subas al repositorio.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          mcp: {
            chartsia: {
              type: 'remote',
              url: mcpUrl,
              ...(esLoopback(mcpUrl) ? {} : { headers: { Authorization: 'Bearer <CHARTSIA_TOKEN>' } }),
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'opencode-local',
    name: 'OpenCode (stdio)',
    help: 'Puente stdio hacia el hub (debe estar corriendo). Para todos tus proyectos, añádelo a ~/.config/opencode/opencode.json; sustituye <RUTA_AL_REPO_CHARTSIA> (antes ejecuta "pnpm build"). Fuera de loopback sustituye <CHARTSIA_TOKEN> y no lo subas al repositorio.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          mcp: {
            chartsia: {
              type: 'local',
              command: ['node', '<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js'],
              environment: { CHARTSIA_URL: mcpUrl, ...(esLoopback(mcpUrl) ? {} : { CHARTSIA_TOKEN: '<CHARTSIA_TOKEN>' }) },
            },
          },
        },
        null,
        2,
      ),
  },
];
