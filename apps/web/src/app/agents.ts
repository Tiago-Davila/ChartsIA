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

/** URL del MCP para los agentes: `*.localhost` solo lo resuelven los navegadores, así que pasa a 127.0.0.1. */
export function mcpUrlParaAgentes(origin: string): string {
  const url = new URL(origin);
  if (url.hostname.endsWith('.localhost')) url.hostname = '127.0.0.1';
  return `${url.origin}/mcp`;
}

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

/** Prompt para pegar en el propio agente: le indica cómo conectarse al hub con el mismo snippet de la tarjeta. */
export function promptInstalacion(agent: Agent, mcpUrl: string): string {
  const snippet = agent.snippet(mcpUrl);
  if (agent.id === 'openai') {
    return [
      'Estoy escribiendo código que llama a la API de Respuestas de OpenAI. Añade a cada petición ChartsIA, el servidor MCP que dibuja diagramas UML y C4, con esta herramienta en el array "tools":',
      snippet,
      `La URL del hub es ${mcpUrl}. El hub debe ser accesible desde internet. Si necesitas el token CHARTSIA_TOKEN, pídemelo; no lo inventes.`,
      'Al terminar, haz una llamada de prueba que liste las herramientas y comprueba que aparece create_diagram.',
    ].join('\n\n');
  }
  return [
    'Conéctate al servidor MCP de ChartsIA, que dibuja diagramas UML y C4.',
    `Añádelo a tu configuración global o de usuario, para que esté disponible en todas mis carpetas, con el nombre chartsia y la URL ${mcpUrl}. Usa esta referencia:`,
    snippet,
    'Si necesitas un dato que no tienes, como el token CHARTSIA_TOKEN o la ruta del repositorio, pídemelo; no lo inventes. Si no puedes editar tu configuración tú mismo, o hace falta reiniciar, dime qué debo hacer.',
    'Al terminar, verifica la conexión listando tus herramientas MCP y comprueba que aparece create_diagram. Si falla, dime el error.',
  ].join('\n\n');
}
