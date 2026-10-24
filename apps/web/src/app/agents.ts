export interface Agent {
  id: string;
  name: string;
  /** Iniciales del recuadro del logo mientras no haya una imagen. */
  monogram: string;
  /**
   * Logo oficial para el tema claro y el oscuro (rutas en `public/`); sin él se muestran las iniciales.
   * Solo se usan logos cuya marca permite mostrarlos sin pedir permiso.
   */
  logo?: { light: string; dark: string };
  /** Tipo de cliente que se muestra bajo el nombre. */
  category: string;
  /** Una frase para la tarjeta de la integración. */
  summary: string;
  /** Nombres que el cliente manda en `clientInfo` al conectarse, para marcarlo como conectado. */
  clients: string[];
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
    monogram: 'CC',
    category: 'Terminal',
    summary: 'Agente de terminal: un comando y queda disponible en todas tus carpetas.',
    clients: ['claude-code'],
    help: 'Ejecuta este comando en tu terminal. Con --scope user queda disponible en todas tus carpetas (se guarda en ~/.claude.json).',
    snippet: (mcpUrl) =>
      `claude mcp add --transport http --scope user chartsia ${mcpUrl}${esLoopback(mcpUrl) ? '' : ' --header "Authorization: Bearer <CHARTSIA_TOKEN>"'}`,
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop (stdio)',
    monogram: 'CD',
    category: 'Escritorio',
    summary: 'La app de escritorio, a través del puente stdio hacia el hub.',
    clients: ['claude-ai'],
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
    monogram: 'OA',
    category: 'API',
    summary: 'Herramienta MCP en cada petición a la Responses API.',
    clients: ['openai-mcp'],
    help: 'No tiene configuración global ni carpetas: la herramienta va en cada petición, en el array "tools". El hub debe ser accesible desde internet y el token va en authorization.',
    snippet: (mcpUrl) => JSON.stringify({ type: 'mcp', server_label: 'chartsia', server_url: mcpUrl, authorization: '<CHARTSIA_TOKEN>' }),
  },
  {
    id: 'xai',
    name: 'xAI Responses API',
    monogram: 'xAI',
    category: 'API',
    summary: 'Herramienta MCP remota en cada petición a la API de Grok.',
    clients: [],
    help: 'No tiene configuración global ni carpetas: la herramienta va en cada petición, en el array "tools". El hub debe ser accesible desde internet por HTTP en streaming y el token va en authorization.',
    snippet: (mcpUrl) => JSON.stringify({ type: 'mcp', server_label: 'chartsia', server_url: mcpUrl, authorization: '<CHARTSIA_TOKEN>' }),
  },
  {
    id: 'opencode-remote',
    name: 'OpenCode (HTTP)',
    monogram: 'OC',
    logo: { light: '/logos/opencode-light.svg', dark: '/logos/opencode-dark.svg' },
    category: 'Terminal',
    summary: 'Servidor remoto en tu opencode.json global o del proyecto.',
    clients: ['opencode'],
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
    monogram: 'OC',
    logo: { light: '/logos/opencode-light.svg', dark: '/logos/opencode-dark.svg' },
    category: 'Terminal',
    summary: 'Puente stdio local, lanzado por OpenCode con node.',
    clients: ['opencode'],
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
  if (agent.id === 'openai' || agent.id === 'xai') {
    const api = agent.id === 'openai' ? 'la API de Respuestas de OpenAI' : 'la API de xAI (Grok)';
    return [
      `Estoy escribiendo código que llama a ${api}. Añade a cada petición ChartsIA, el servidor MCP que dibuja diagramas UML y C4, con esta herramienta en el array "tools":`,
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
