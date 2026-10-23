import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENTS, mcpUrlParaAgentes, promptInstalacion } from '../../src/app/agents';
import { ConfigScreen } from '../../src/app/ConfigScreen';
import { type ConnectedAgent } from '../../src/state/api-client';
import { clearToken, setToken } from '../../src/state/auth-token';

const origin = 'http://127.0.0.1:3333';
let agents: ConnectedAgent[] = [];
const renderScreen = () => render(<ConfigScreen origin={origin} agents={agents} connection="connected" onBack={vi.fn()} />);

describe('ConfigScreen', () => {
  afterEach(() => {
    agents = [];
    clearToken();
    vi.restoreAllMocks();
  });

  it('muestra la URL del MCP, el estado del hub y una tarjeta por agente', () => {
    renderScreen();
    expect(screen.getByText(`${origin}/mcp`)).toBeInTheDocument();
    expect(screen.getByText('Conectado al hub')).toBeInTheDocument();
    for (const agent of AGENTS) expect(screen.getByRole('article', { name: agent.name })).toBeInTheDocument();
    expect(screen.getByText(`claude mcp add --transport http --scope user chartsia ${origin}/mcp`)).toBeInTheDocument();
  });

  it('el comando de Claude Code es de usuario y añade el token fuera de loopback', () => {
    const claude = AGENTS.find((a) => a.id === 'claude-code')!;
    expect(claude.snippet(`${origin}/mcp`)).toBe(`claude mcp add --transport http --scope user chartsia ${origin}/mcp`);
    expect(claude.snippet('https://hub.example.com/mcp')).toContain('--scope user');
    expect(claude.snippet('https://hub.example.com/mcp')).toContain('Authorization: Bearer <CHARTSIA_TOKEN>');
  });

  it('la URL del MCP para los agentes cambia *.localhost por 127.0.0.1, que resuelven fuera del navegador', () => {
    expect(mcpUrlParaAgentes('http://chartsia.localhost:3333')).toBe('http://127.0.0.1:3333/mcp');
    expect(mcpUrlParaAgentes('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173/mcp');
    expect(mcpUrlParaAgentes('https://hub.example.com')).toBe('https://hub.example.com/mcp');
  });

  it('los agentes stdio lanzan el puente con node y su ruta absoluta, no con pnpm exec (#251)', () => {
    const mcpUrl = `${origin}/mcp`;
    for (const agent of AGENTS) expect(agent.snippet(mcpUrl)).not.toContain('chartsia-mcp');
    for (const id of ['claude-desktop', 'opencode-local']) {
      expect(AGENTS.find((a) => a.id === id)!.snippet(mcpUrl)).toContain('<RUTA_AL_REPO_CHARTSIA>/apps/api/dist/stdio-bridge.js');
    }
  });

  it('solo la Responses API, que no tiene configuración global, lo explica en su ayuda', () => {
    const sinGlobal = AGENTS.filter((a) => /no tiene configuración global/i.test(a.help));
    expect(sinGlobal.map((a) => a.id)).toEqual(['openai']);
  });

  it('muestra en la tarjeta la ayuda de Claude Desktop con su archivo de configuración', () => {
    renderScreen();
    const card = screen.getByRole('article', { name: 'Claude Desktop (stdio)' });
    expect(card).toHaveTextContent('claude_desktop_config.json');
    expect(JSON.parse(AGENTS.find((a) => a.id === 'claude-desktop')!.snippet(`${origin}/mcp`)).mcpServers.chartsia.command).toBe('node');
  });

  it('los snippets de OpenCode son JSON válido con la URL del hub', () => {
    const snippet = (id: string, url: string) => JSON.parse(AGENTS.find((a) => a.id === id)!.snippet(url));
    for (const id of ['opencode-remote', 'opencode-local']) {
      const config = snippet(id, `${origin}/mcp`);
      expect(config.$schema).toBe('https://opencode.ai/config.json');
      expect(JSON.stringify(config.mcp.chartsia)).toContain(`${origin}/mcp`);
      expect(JSON.stringify(config)).not.toContain('Bearer');
    }
    const remoto = snippet('opencode-remote', 'https://hub.example.com/mcp');
    expect(remoto.mcp.chartsia.headers.Authorization).toBe('Bearer <CHARTSIA_TOKEN>');
  });

  it('lista los agentes conectados con su versión y su última llamada, o avisa si no hay', () => {
    const { unmount } = renderScreen();
    expect(screen.getByText('Ningún agente se ha conectado todavía.')).toBeInTheDocument();
    unmount();
    agents = [{ id: 1, name: '<b>claude-code</b>', version: '2.1.0', lastCallAt: '2026-01-02T03:04:00.000Z' }];
    renderScreen();
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('<b>claude-code</b> v2.1.0 · última llamada');
    expect(item.querySelector('b')).toBeNull();
  });

  it('copia el comando de la tarjeta', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Copiar configuración de Claude Code (HTTP)' }));
    expect(writeText).toHaveBeenCalledWith(`claude mcp add --transport http --scope user chartsia ${origin}/mcp`);
    expect(await screen.findByText('Copiado')).toBeInTheDocument();
  });

  it('todos los agentes tienen prompt de instalación con la URL del MCP', () => {
    for (const agent of AGENTS) {
      const prompt = promptInstalacion(agent, `${origin}/mcp`);
      expect(prompt.trim()).not.toBe('');
      expect(prompt).toContain(`${origin}/mcp`);
      expect(prompt).toContain('create_diagram');
    }
  });

  it('cada tarjeta muestra el botón de copiar comando y el de copiar prompt', () => {
    renderScreen();
    for (const agent of AGENTS) {
      const card = screen.getByRole('article', { name: agent.name });
      expect(within(card).getByRole('button', { name: `Copiar configuración de ${agent.name}` })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: `Copiar prompt de ${agent.name}` })).toBeInTheDocument();
    }
  });

  it('copia el prompt de la tarjeta', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderScreen();
    const claude = AGENTS.find((a) => a.id === 'claude-code')!;
    await user.click(screen.getByRole('button', { name: `Copiar prompt de ${claude.name}` }));
    expect(writeText).toHaveBeenCalledWith(promptInstalacion(claude, `${origin}/mcp`));
  });

  it('avisa si no se puede copiar', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denegado'));
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Copiar URL del MCP' }));
    expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
  });

  it('sin token lo indica; con token lo enmascara y permite verlo', async () => {
    const { unmount } = renderScreen();
    expect(screen.getByText(/No hay token guardado/)).toBeInTheDocument();
    unmount();
    setToken('secreto-123');
    renderScreen();
    expect(screen.queryByText('secreto-123')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ver token' }));
    expect(screen.getByText('secreto-123')).toBeInTheDocument();
  });
});
