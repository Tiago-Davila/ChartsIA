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

/** VS Code pide el token al arrancar el servidor y no lo escribe en el archivo. */
const inputToken = { type: 'promptString', id: 'chartsia-token', description: 'Token de ChartsIA', password: true };

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
    id: 'grok',
    name: 'Grok (xAI API)',
    help: 'Herramienta MCP para la API de xAI (POST https://api.x.ai/v1/responses, dentro de "tools"). xAI no llega a loopback: expón el hub con un túnel (CHARTSIA_HOST=0.0.0.0, token obligatorio) y sustituye <túnel> y <CHARTSIA_TOKEN>; no subas el token al repositorio.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          type: 'mcp',
          server_label: 'chartsia',
          server_url: esLoopback(mcpUrl) ? 'https://<túnel>/mcp' : mcpUrl,
          headers: { Authorization: 'Bearer <CHARTSIA_TOKEN>' },
        },
        null,
        2,
      ),
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
  {
    id: 'gemini-remote',
    name: 'Gemini CLI (HTTP)',
    help: 'Añádelo a "mcpServers" en .gemini/settings.json del proyecto (mejor que el global ~/.gemini/settings.json). Fuera de loopback, sustituye <CHARTSIA_TOKEN> y no lo subas al repositorio.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          mcpServers: {
            chartsia: {
              httpUrl: mcpUrl,
              ...(esLoopback(mcpUrl) ? {} : { headers: { Authorization: 'Bearer <CHARTSIA_TOKEN>' } }),
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'gemini-local',
    name: 'Gemini CLI (stdio)',
    help: 'Puente stdio hacia el hub (debe estar corriendo y el repositorio compilado con pnpm build). Va en .gemini/settings.json del proyecto; sustituye la ruta del repositorio. Fuera de loopback sustituye <CHARTSIA_TOKEN> y no lo subas al repositorio.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          mcpServers: {
            chartsia: {
              command: 'node',
              args: ['apps/api/dist/stdio-bridge.js'],
              cwd: '<RUTA_AL_REPO_CHARTSIA>',
              env: { CHARTSIA_URL: mcpUrl, ...(esLoopback(mcpUrl) ? {} : { CHARTSIA_TOKEN: '<CHARTSIA_TOKEN>' }) },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'copilot-remote',
    name: 'GitHub Copilot (HTTP)',
    help: 'Va en .vscode/mcp.json del proyecto. Abre el chat de Copilot en modo Agent y habilita las herramientas de chartsia. Fuera de loopback VS Code pide el token al arrancar el servidor y no queda en el archivo.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          ...(esLoopback(mcpUrl) ? {} : { inputs: [inputToken] }),
          servers: {
            chartsia: {
              type: 'http',
              url: mcpUrl,
              ...(esLoopback(mcpUrl) ? {} : { headers: { Authorization: 'Bearer ${input:chartsia-token}' } }),
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'copilot-local',
    name: 'GitHub Copilot (stdio)',
    help: 'Puente stdio hacia el hub (debe estar corriendo y el repositorio compilado con pnpm build). Va en .vscode/mcp.json; sustituye la ruta del repositorio. Abre el chat de Copilot en modo Agent y habilita las herramientas de chartsia.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          ...(esLoopback(mcpUrl) ? {} : { inputs: [inputToken] }),
          servers: {
            chartsia: {
              type: 'stdio',
              command: 'node',
              args: ['apps/api/dist/stdio-bridge.js'],
              cwd: '<RUTA_AL_REPO_CHARTSIA>',
              env: { CHARTSIA_URL: mcpUrl, ...(esLoopback(mcpUrl) ? {} : { CHARTSIA_TOKEN: '${input:chartsia-token}' }) },
            },
          },
        },
        null,
        2,
      ),
  },
];
