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
    help: 'Ejecuta este comando en tu terminal.',
    snippet: (mcpUrl) => `claude mcp add --transport http chartsia ${mcpUrl}`,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop (stdio)',
    help: 'Puente stdio hacia el hub (debe estar corriendo). Variables: CHARTSIA_URL y CHARTSIA_TOKEN.',
    snippet: () => 'pnpm --filter @chartsia/api exec chartsia-mcp',
  },
  {
    id: 'openai',
    name: 'OpenAI Responses API',
    help: 'Herramienta MCP; el hub debe ser accesible desde internet y el token va en authorization.',
    snippet: (mcpUrl) => JSON.stringify({ type: 'mcp', server_label: 'chartsia', server_url: mcpUrl, authorization: '<CHARTSIA_TOKEN>' }),
  },
  {
    id: 'opencode-remote',
    name: 'OpenCode (HTTP)',
    help: 'Añádelo a "mcp" en opencode.json. Fuera de loopback, sustituye <CHARTSIA_TOKEN> y no lo subas al repositorio.',
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
    help: 'Puente stdio hacia el hub (debe estar corriendo). Sustituye la ruta del repositorio; fuera de loopback sustituye <CHARTSIA_TOKEN> y no lo subas al repositorio.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          mcp: {
            chartsia: {
              type: 'local',
              command: ['pnpm', '--filter', '@chartsia/api', 'exec', 'chartsia-mcp'],
              cwd: '<RUTA_AL_REPO_CHARTSIA>',
              environment: { CHARTSIA_URL: mcpUrl, ...(esLoopback(mcpUrl) ? {} : { CHARTSIA_TOKEN: '<CHARTSIA_TOKEN>' }) },
            },
          },
        },
        null,
        2,
      ),
  },
];
