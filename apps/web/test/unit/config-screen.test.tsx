import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENTS, mcpUrlParaAgentes, promptInstalacion } from '../../src/app/agents';
import { DEFAULT_CANVAS_PREFERENCES, canvasPreferences, setCanvasPreferences } from '../../src/app/canvas-preferences';
import { ConfigScreen } from '../../src/app/ConfigScreen';
import { type ConnectedAgent, type HubInfo } from '../../src/state/api-client';

const origin = 'http://127.0.0.1:24278';
let agents: ConnectedAgent[] = [];
let hub: HubInfo | null = null;
const renderScreen = (section: 'general' | 'lienzo' | 'mcp' = 'mcp', onSection = vi.fn()) =>
  render(<ConfigScreen origin={origin} agents={agents} hub={hub} section={section} onSection={onSection} onBack={vi.fn()} />);

/** Abre la ventana de conexión de un agente desde su tarjeta. */
const abrir = async (nombre: string) => {
  await userEvent.click(within(screen.getByRole('article', { name: nombre })).getByRole('button'));
  return screen.getByRole('dialog', { name: `Conectar ${nombre}` });
};

describe('ConfigScreen', () => {
  afterEach(() => {
    agents = [];
    hub = null;
    setCanvasPreferences(DEFAULT_CANVAS_PREFERENCES);
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tiene su propia barra con General y Conexiones MCP, y General no muestra agentes', async () => {
    const onSection = vi.fn();
    renderScreen('general', onSection);
    const secciones = screen.getByRole('list', { name: 'Secciones' });
    expect(within(secciones).getByRole('button', { name: 'General' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'General' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    await userEvent.click(within(secciones).getByRole('button', { name: 'Conexiones MCP' }));
    expect(onSection).toHaveBeenCalledWith('mcp');
  });

  it('el tema está en General, sigue al sistema por defecto y recuerda la elección', async () => {
    renderScreen('general');
    expect(screen.queryByRole('button', { name: /Cambiar a tema/ })).toBeNull();
    const temas = screen.getByRole('group', { name: 'Tema' });
    expect(within(temas).getByRole('radio', { name: 'Según el sistema' })).toBeChecked();
    await userEvent.click(within(temas).getByRole('radio', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('chartsia.theme')).toBe('dark');
    await userEvent.click(within(temas).getByRole('radio', { name: 'Claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('chartsia.theme')).toBe('light');
  });

  it('con "Según el sistema" el tema cambia cuando cambia el del sistema', async () => {
    let oscuro = false;
    const oyentes: (() => void)[] = [];
    vi.stubGlobal('matchMedia', () => ({ get matches() { return oscuro; }, addEventListener: (_: string, fn: () => void) => oyentes.push(fn), removeEventListener: vi.fn() }));
    localStorage.setItem('chartsia.theme', 'light');
    renderScreen('general');
    await userEvent.click(screen.getByRole('radio', { name: 'Según el sistema' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    oscuro = true;
    for (const fn of oyentes) fn();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('chartsia.theme')).toBe('system');
  });

  it('Lienzo está en la barra y sus opciones empiezan con los valores por defecto', () => {
    renderScreen('lienzo');
    expect(within(screen.getByRole('list', { name: 'Secciones' })).getByRole('button', { name: 'Lienzo' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('region', { name: 'Lienzo' })).toBeInTheDocument();
    const marcadas: [string, string][] = [
      ['Cuadrícula', 'Mostrar'],
      ['Tamaño de la cuadrícula', '20 px'],
      ['Ajustar a la cuadrícula al mover', 'No'],
      ['Minimapa', 'Mostrar'],
      ['Controles de zoom', 'Mostrar'],
      ['Al abrir un diagrama', 'Ajustar a la pantalla'],
      ['Animaciones', 'Según el sistema'],
      ['Cuando el agente cambia el diagrama', 'Abrirlo automáticamente'],
    ];
    for (const [leyenda, opcion] of marcadas) expect(within(screen.getByRole('group', { name: leyenda })).getByRole('radio', { name: opcion })).toBeChecked();
  });

  it.each([
    ['Cuadrícula', 'Ocultar', { grid: false }],
    ['Tamaño de la cuadrícula', '40 px', { gridSize: 40 }],
    ['Ajustar a la cuadrícula al mover', 'Sí', { snapToGrid: true }],
    ['Minimapa', 'Ocultar', { minimap: false }],
    ['Controles de zoom', 'Ocultar', { zoomControls: false }],
    ['Al abrir un diagrama', 'Mostrar al 100 %', { onOpen: 'actual' }],
    ['Animaciones', 'Reducidas', { animations: 'reduced' }],
    ['Cuando el agente cambia el diagrama', 'Solo mostrar un aviso', { onAgentChange: 'notice' }],
  ])('en Lienzo, "%s" → "%s" se aplica al instante y se guarda', async (leyenda, opcion, esperado) => {
    renderScreen('lienzo');
    await userEvent.click(within(screen.getByRole('group', { name: leyenda })).getByRole('radio', { name: opcion }));
    expect(within(screen.getByRole('group', { name: leyenda })).getByRole('radio', { name: opcion })).toBeChecked();
    expect(canvasPreferences()).toMatchObject(esperado);
    expect(JSON.parse(localStorage.getItem('chartsia.canvas')!)).toMatchObject(esperado);
  });

  it('muestra versión, puerto, URL del MCP y carpeta de datos del hub', () => {
    hub = { version: '0.1.0', port: 24278, dataDir: '/home/ana/.chartsia/diagrams' };
    renderScreen('general');
    const datos = screen.getByRole('region', { name: 'General' });
    expect(datos).toHaveTextContent('Versión0.1.0');
    expect(datos).toHaveTextContent('Puerto24278');
    expect(within(datos).getByText(`${origin}/mcp`)).toBeInTheDocument();
    expect(within(datos).getByText('/home/ana/.chartsia/diagrams')).toBeInTheDocument();
    expect(within(datos).getByRole('button', { name: 'Copiar carpeta de datos' })).toBeInTheDocument();
  });

  it('mientras el hub no responde, avisa que los datos están cargando', () => {
    renderScreen('general');
    expect(screen.getByText('Cargando los datos del hub…')).toBeInTheDocument();
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
    expect(within(conectados).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['OpenCode', 'OpenCode (stdio)']);
    expect(within(conectados).getAllByRole('button', { name: 'Conectado' })).toHaveLength(2);
    expect(within(habilitados).getByRole('article', { name: 'Claude Code (HTTP)' })).toBeInTheDocument();
    expect(within(habilitados).queryByRole('button', { name: 'Conectado' })).toBeNull();
  });

  it('las tarjetas no llevan logo ni iniciales', () => {
    renderScreen();
    for (const article of screen.getAllByRole('article')) {
      expect(article.querySelector('img, .integration__logo')).toBeNull();
    }
  });

  it('el comando de cada agente de terminal es el de la sección "Conectar agentes" del README', () => {
    const readme = readFileSync(resolve(__dirname, '../../../../README.md'), 'utf8');
    const porAgente = { 'claude-code': 'Claude Code', codex: 'Codex CLI', gemini: 'Gemini CLI', 'grok-build': 'Grok Build', opencode: 'OpenCode' };
    for (const [id, titulo] of Object.entries(porAgente)) {
      const comando = readme.match(new RegExp(String.raw`\*\*${titulo}\*\*\s+` + '```bash\\n(.+)\\n```'))?.[1];
      expect(comando, `README sin comando para ${titulo}`).toBeDefined();
      expect(AGENTS.find((a) => a.id === id)!.snippet('http://127.0.0.1:24278/mcp')).toBe(comando);
    }
  });

  it('los comandos de Gemini CLI y OpenCode usan la URL del hub', () => {
    const snippet = (id: string) => AGENTS.find((a) => a.id === id)!.snippet(`${origin}/mcp`);
    expect(snippet('gemini')).toBe(`gemini mcp add --scope user --transport http chartsia ${origin}/mcp`);
    expect(snippet('opencode')).toBe(`opencode mcp add chartsia --url ${origin}/mcp`);
  });

  it('ningún agente usa token: todos corren en la misma máquina que el hub', () => {
    for (const agent of AGENTS) {
      const texto = [agent.help, agent.summary, agent.snippet('https://hub.example.com/mcp'), promptInstalacion(agent, `${origin}/mcp`)].join(' ');
      expect(texto).not.toMatch(/token|Bearer|Authorization/i);
      expect(agent.summary).not.toMatch(/remot/i);
    }
  });

  it('el comando de Claude Code es de usuario', () => {
    const claude = AGENTS.find((a) => a.id === 'claude-code')!;
    expect(claude.snippet(`${origin}/mcp`)).toBe(`claude mcp add --transport http --scope user chartsia ${origin}/mcp`);
  });

  it('la URL del MCP para los agentes cambia *.localhost por 127.0.0.1, que resuelven fuera del navegador', () => {
    expect(mcpUrlParaAgentes('http://chartsia.localhost:24278')).toBe('http://127.0.0.1:24278/mcp');
    expect(mcpUrlParaAgentes('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173/mcp');
    expect(mcpUrlParaAgentes('https://hub.example.com')).toBe('https://hub.example.com/mcp');
  });

  it('los agentes stdio lanzan el puente del paquete de npm con npx, no con pnpm exec (#251)', () => {
    const mcpUrl = `${origin}/mcp`;
    for (const agent of AGENTS) expect(agent.snippet(mcpUrl)).not.toContain('pnpm');
    const desktop = JSON.parse(AGENTS.find((a) => a.id === 'claude-desktop')!.snippet(mcpUrl)).mcpServers.chartsia;
    expect([desktop.command, ...desktop.args]).toEqual(['npx', '-y', '-p', 'chartsia', 'chartsia-mcp']);
    const opencode = JSON.parse(AGENTS.find((a) => a.id === 'opencode-local')!.snippet(mcpUrl)).mcp.chartsia;
    expect(opencode.command).toEqual(['npx', '-y', '-p', 'chartsia', 'chartsia-mcp']);
  });

  it('la ventana de Claude Desktop explica su archivo de configuración', async () => {
    renderScreen();
    expect(await abrir('Claude Desktop (stdio)')).toHaveTextContent('claude_desktop_config.json');
    expect(JSON.parse(AGENTS.find((a) => a.id === 'claude-desktop')!.snippet(`${origin}/mcp`)).mcpServers.chartsia.command).toBe('npx');
  });

  it('el snippet de OpenCode por stdio es JSON válido con la URL del hub', () => {
    const config = JSON.parse(AGENTS.find((a) => a.id === 'opencode-local')!.snippet(`${origin}/mcp`));
    expect(config.$schema).toBe('https://opencode.ai/config.json');
    expect(JSON.stringify(config.mcp.chartsia)).toContain(`${origin}/mcp`);
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
