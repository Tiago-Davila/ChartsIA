import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENTS, mcpUrlParaAgentes, promptInstalacion } from '../../src/app/agents';
import { ConfigScreen } from '../../src/app/ConfigScreen';
import { type ConnectedAgent } from '../../src/state/api-client';

const origin = 'http://127.0.0.1:3333';
let agents: ConnectedAgent[] = [];
const renderScreen = (section: 'general' | 'mcp' = 'mcp', onSection = vi.fn()) =>
  render(<ConfigScreen origin={origin} agents={agents} section={section} onSection={onSection} onBack={vi.fn()} />);

/** Abre la ventana de conexión de un agente desde su tarjeta. */
const abrir = async (nombre: string) => {
  await userEvent.click(within(screen.getByRole('article', { name: nombre })).getByRole('button'));
  return screen.getByRole('dialog', { name: `Conectar ${nombre}` });
};

describe('ConfigScreen', () => {
  afterEach(() => {
    agents = [];
    vi.restoreAllMocks();
  });

  it('tiene su propia barra con General y Conexiones MCP, y General por ahora está vacía', async () => {
    const onSection = vi.fn();
    renderScreen('general', onSection);
    const secciones = screen.getByRole('list', { name: 'Secciones' });
    expect(within(secciones).getByRole('button', { name: 'General' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'General' })).toBeInTheDocument();
    expect(screen.queryByText(`${origin}/mcp`)).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
    await userEvent.click(within(secciones).getByRole('button', { name: 'Conexiones MCP' }));
    expect(onSection).toHaveBeenCalledWith('mcp');
  });

  it('muestra solo las tarjetas de los agentes, sin la URL del MCP ni el estado del hub', async () => {
    renderScreen();
    expect(screen.getByRole('region', { name: 'Conexiones MCP' })).toBeInTheDocument();
    expect(screen.queryByText(`${origin}/mcp`)).toBeNull();
    expect(screen.queryByText('Conectado al hub')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Conectados' })).toBeNull();
    for (const agent of AGENTS) {
      const card = screen.getByRole('article', { name: agent.name });
      expect(card).toHaveTextContent(agent.summary);
      expect(within(card).getByRole('button', { name: 'Conectar' })).toBeInTheDocument();
    }
    const ventana = await abrir('Claude Code (HTTP)');
    expect(within(ventana).getByText(`claude mcp add --transport http --scope user chartsia ${origin}/mcp`)).toBeInTheDocument();
    await userEvent.click(within(ventana).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('primero muestra los conectados y después los habilitados', () => {
    agents = [{ id: 1, name: 'opencode', version: '1.0.0', lastCallAt: '2026-01-02T03:04:00.000Z' }];
    renderScreen();
    const conectados = screen.getByRole('region', { name: 'Conectados' });
    const habilitados = screen.getByRole('region', { name: 'Habilitados' });
    expect(conectados.compareDocumentPosition(habilitados) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(conectados).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['OpenCode (HTTP)', 'OpenCode (stdio)']);
    expect(within(conectados).getAllByRole('button', { name: 'Conectado' })).toHaveLength(2);
    expect(within(habilitados).getByRole('article', { name: 'Claude Code (HTTP)' })).toBeInTheDocument();
    expect(within(habilitados).queryByRole('button', { name: 'Conectado' })).toBeNull();
  });

  it('OpenCode lleva su logo oficial en las dos versiones del tema; el resto, sus iniciales', () => {
    renderScreen();
    const opencode = screen.getByRole('article', { name: 'OpenCode (HTTP)' });
    expect(Array.from(opencode.querySelectorAll('img')).map((i) => i.getAttribute('src'))).toEqual(['/logos/opencode-light.svg', '/logos/opencode-dark.svg']);
    const claude = screen.getByRole('article', { name: 'Claude Code (HTTP)' });
    expect(claude.querySelector('img')).toBeNull();
    expect(claude).toHaveTextContent('CC');
  });

  it('xAI se conecta como herramienta MCP remota en cada petición', () => {
    const xai = AGENTS.find((a) => a.id === 'xai')!;
    expect(JSON.parse(xai.snippet(`${origin}/mcp`))).toEqual({ type: 'mcp', server_label: 'chartsia', server_url: `${origin}/mcp`, authorization: '<CHARTSIA_TOKEN>' });
    expect(promptInstalacion(xai, `${origin}/mcp`)).toContain('xAI');
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

  it('solo las API de respuestas, que no tienen configuración global, lo explican en su ayuda', () => {
    const sinGlobal = AGENTS.filter((a) => /no tiene configuración global/i.test(a.help));
    expect(sinGlobal.map((a) => a.id)).toEqual(['openai', 'xai']);
  });

  it('la ventana de Claude Desktop explica su archivo de configuración', async () => {
    renderScreen();
    expect(await abrir('Claude Desktop (stdio)')).toHaveTextContent('claude_desktop_config.json');
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

  it('copia el comando de la tarjeta', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderScreen();
    await abrir('Claude Code (HTTP)');
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

  it('en la ventana de cada tarjeta el botón de copiar va dentro del comando y dentro del prompt', async () => {
    renderScreen();
    for (const agent of AGENTS) {
      const ventana = await abrir(agent.name);
      const comando = within(ventana).getByRole('button', { name: `Copiar configuración de ${agent.name}` });
      expect(comando.closest('.code-block')!.querySelector('code')!.textContent).toBe(agent.snippet(`${origin}/mcp`));
      const prompt = within(ventana).getByRole('button', { name: `Copiar prompt de ${agent.name}` });
      expect(prompt.closest('.code-block')).toHaveTextContent('create_diagram');
      expect(within(ventana).queryByRole('button', { name: 'Copiar' })).toBeNull();
      await userEvent.click(within(ventana).getByRole('button', { name: 'Cerrar' }));
    }
  });

  it('copia el prompt de la tarjeta', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderScreen();
    const claude = AGENTS.find((a) => a.id === 'claude-code')!;
    await abrir(claude.name);
    await user.click(screen.getByRole('button', { name: `Copiar prompt de ${claude.name}` }));
    expect(writeText).toHaveBeenCalledWith(promptInstalacion(claude, `${origin}/mcp`));
  });

  it('avisa si no se puede copiar', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denegado'));
    renderScreen();
    await abrir('Claude Code (HTTP)');
    await user.click(screen.getByRole('button', { name: 'Copiar configuración de Claude Code (HTTP)' }));
    expect(await screen.findByText(/No se pudo copiar/)).toBeInTheDocument();
  });
});
