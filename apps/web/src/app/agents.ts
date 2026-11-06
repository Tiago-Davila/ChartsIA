export interface Agent {
  id: string;
  name: string;
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
  /** Documentación oficial del agente sobre servidores MCP. */
  docs: string;
  /** Enlace que instala ChartsIA en el agente con un clic, si el agente lo admite. */
  install?(mcpUrl: string): string;
}

/** URL del MCP para los agentes: `*.localhost` solo lo resuelven los navegadores, así que pasa a 127.0.0.1. */
export function mcpUrlParaAgentes(origin: string): string {
  const url = new URL(origin);
  if (url.hostname.endsWith('.localhost')) url.hostname = '127.0.0.1';
  return `${url.origin}/mcp`;
}

/**
 * Agentes de la pantalla de configuración: para sumar una tarjeta basta añadir una entrada aquí.
 * Todos corren en la misma máquina que el hub, así que ninguno necesita token.
 * Los comandos replican la sección "Conectar agentes" del README: mantenerlos sincronizados.
 */
export const AGENTS: Agent[] = [
  {
    id: 'claude-code',
    docs: 'https://code.claude.com/docs/en/mcp',
    name: 'Claude Code (HTTP)',
    category: 'Terminal',
    summary: 'Agente de terminal: un comando y queda disponible en todas tus carpetas.',
    clients: ['claude-code'],
    help: 'Ejecuta este comando en tu terminal. Con --scope user queda disponible en todas tus carpetas (se guarda en ~/.claude.json).',
    snippet: (mcpUrl) => `claude mcp add --transport http --scope user chartsia ${mcpUrl}`,
  },
  {
    id: 'claude-desktop',
    docs: 'https://modelcontextprotocol.io/docs/develop/connect-local-servers',
    name: 'Claude Desktop (stdio)',
    category: 'Escritorio',
    summary: 'La app de escritorio, a través del puente stdio hacia el hub.',
    clients: ['claude-ai'],
    help: 'Claude Desktop es global por usuario. Pega este bloque en claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/; Windows: %APPDATA%\\Claude\\), reinicia Claude Desktop y deja el hub corriendo (npx chartsia).',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          mcpServers: {
            chartsia: {
              command: 'npx',
              args: ['-y', '-p', 'chartsia', 'chartsia-mcp'],
              env: { CHARTSIA_URL: mcpUrl },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'codex',
    docs: 'https://developers.openai.com/codex/mcp',
    name: 'Codex CLI',
    category: 'Terminal',
    summary: 'Agente de terminal de OpenAI: un comando y queda disponible en todas tus carpetas.',
    clients: ['codex-mcp-client'],
    help: 'Ejecuta este comando en tu terminal. Queda en ~/.codex/config.toml, disponible en todas tus carpetas.',
    snippet: (mcpUrl) => `codex mcp add chartsia --url ${mcpUrl}`,
  },
  {
    id: 'gemini',
    docs: 'https://geminicli.com/docs/tools/mcp-server/',
    name: 'Gemini CLI',
    category: 'Terminal',
    summary: 'Agente de terminal de Google: un comando y queda disponible en todas tus carpetas.',
    clients: ['gemini-cli-mcp-client'],
    help: 'Ejecuta este comando en tu terminal. Con --scope user queda en tu configuración de usuario, disponible en todas tus carpetas.',
    snippet: (mcpUrl) => `gemini mcp add --scope user --transport http chartsia ${mcpUrl}`,
  },
  {
    id: 'grok-build',
    docs: 'https://docs.x.ai/build/features/mcp-servers',
    name: 'Grok Build',
    category: 'Terminal',
    summary: 'Agente de terminal de xAI: un comando y queda disponible en todas tus carpetas.',
    clients: [],
    help: 'Ejecuta este comando en tu terminal. Queda en ~/.grok/config.toml, disponible en todas tus carpetas.',
    snippet: (mcpUrl) => `grok mcp add --transport http chartsia ${mcpUrl}`,
  },
  {
    id: 'opencode',
    docs: 'https://opencode.ai/docs/mcp-servers/',
    name: 'OpenCode',
    category: 'Terminal',
    summary: 'Agente de terminal de código abierto: un comando y queda disponible en todas tus carpetas.',
    clients: ['opencode'],
    help: 'Ejecuta este comando en tu terminal. Queda en tu configuración global de OpenCode, disponible en todas tus carpetas.',
    snippet: (mcpUrl) => `opencode mcp add chartsia --url ${mcpUrl}`,
  },
  {
    id: 'opencode-local',
    docs: 'https://opencode.ai/docs/mcp-servers/',
    name: 'OpenCode (stdio)',
    category: 'Terminal',
    summary: 'Puente stdio local, lanzado por OpenCode con npx.',
    clients: ['opencode'],
    help: 'Puente stdio hacia el hub (debe estar corriendo). Para todos tus proyectos, añádelo a ~/.config/opencode/opencode.json.',
    snippet: (mcpUrl) =>
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          mcp: {
            chartsia: {
              type: 'local',
              command: ['npx', '-y', '-p', 'chartsia', 'chartsia-mcp'],
              environment: { CHARTSIA_URL: mcpUrl },
            },
          },
        },
        null,
        2,
      ),
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot (VS Code)',
    category: 'Editor',
    summary: 'El modo agente de Copilot en VS Code: un comando y queda disponible en todas tus carpetas.',
    clients: ['Visual Studio Code', 'Visual Studio Code - Insiders'],
    help: 'Ejecuta este comando en tu terminal. Queda en tu perfil de usuario de VS Code, disponible en todas tus carpetas; después elige ChartsIA en las herramientas del modo agente.',
    docs: 'https://code.visualstudio.com/docs/copilot/customization/mcp-servers',
    snippet: (mcpUrl) => `code --add-mcp '${JSON.stringify({ name: 'chartsia', type: 'http', url: mcpUrl })}'`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'Editor',
    summary: 'El editor con agente de Anysphere: instálalo con un clic o pega el bloque en tu configuración.',
    clients: ['cursor-vscode'],
    help: 'Pega este bloque en ~/.cursor/mcp.json para tenerlo en todas tus carpetas (o en .cursor/mcp.json de un proyecto). También puedes instalarlo con el botón.',
    docs: 'https://cursor.com/docs/context/mcp',
    snippet: (mcpUrl) => JSON.stringify({ mcpServers: { chartsia: { url: mcpUrl } } }, null, 2),
    install: (mcpUrl) => `cursor://anysphere.cursor-deeplink/mcp/install?name=chartsia&config=${btoa(JSON.stringify({ url: mcpUrl }))}`,
  },
];

/** Prompt para pegar en el propio agente: le indica cómo conectarse al hub con el mismo snippet de la tarjeta. */
export function promptInstalacion(agent: Agent, mcpUrl: string): string {
  return [
    'Conéctate al servidor MCP de ChartsIA, que dibuja diagramas UML y C4.',
    `Añádelo a tu configuración global o de usuario, para que esté disponible en todas mis carpetas, con el nombre chartsia y la URL ${mcpUrl}. Usa esta referencia, que es un comando o un bloque de configuración:`,
    agent.snippet(mcpUrl),
    'Si necesitas un dato que no tienes, pídemelo; no lo inventes. Si no puedes editar tu configuración tú mismo, o hace falta reiniciar, dime qué debo hacer.',
    'Al terminar, verifica la conexión listando tus herramientas MCP y comprueba que aparece create_diagram. Si falla, dime el error.',
  ].join('\n\n');
}
