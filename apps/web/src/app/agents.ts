export interface Agent {
  id: string;
  name: string;
  /** Instrucción corta de uso. */
  help: string;
  /** Comando o configuración que se copia. */
  snippet(mcpUrl: string): string;
}

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
];
