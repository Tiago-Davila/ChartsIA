import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentNotice } from '../../src/app/AgentNotice';
import { DEFAULT_CANVAS_PREFERENCES, setCanvasPreferences } from '../../src/app/canvas-preferences';
import { parseRoute } from '../../src/app/routes';
import { type ApiClient } from '../../src/state/api-client';
import { diagramStore } from '../../src/state/diagram-store';
import { type LiveHandlers } from '../../src/state/live-client';
import { useHubSync } from '../../src/state/use-hub-sync';

// Captura los manejadores del canal en vivo para simular lo que avisa el hub.
const live = vi.hoisted(() => ({ handlers: undefined as LiveHandlers | undefined }));
vi.mock('../../src/state/live-client', () => ({
  createLiveClient: (_getToken: unknown, handlers: LiveHandlers) => {
    live.handlers = handlers;
    return { close: vi.fn(), subscribe: vi.fn(), reconnect: vi.fn() };
  },
}));

const ABIERTO = 'dg_aaaaaaaaaaaa';
const DEL_AGENTE = 'dg_bbbbbbbbbbbb';
const api = {
  listDiagrams: vi.fn(async () => ({ diagrams: [], projects: [], activeDiagramId: null })),
  listAgents: vi.fn(async () => []),
  getHub: vi.fn(async () => ({ version: '0', port: 0, dataDir: '' })),
  getDiagram: vi.fn(() => new Promise(() => {})),
  activate: vi.fn(async () => {}),
} as unknown as ApiClient;

/** Monta la sincronización con el diagrama ABIERTO en pantalla. */
function montar() {
  window.history.pushState(null, '', `/d/${ABIERTO}`);
  renderHook(() => useHubSync(api, parseRoute(window.location.pathname)));
}

describe('cuando el agente abre otro diagrama', () => {
  beforeEach(() => {
    diagramStore.setState({ ...diagramStore.getInitialState(), diagrams: [{ diagramId: DEL_AGENTE, type: 'class', title: 'Pedidos', revision: 1, updatedAt: '2026-10-20T10:00:00.000Z' }] });
  });
  afterEach(() => {
    setCanvasPreferences(DEFAULT_CANVAS_PREFERENCES);
    localStorage.clear();
    window.history.pushState(null, '', '/');
  });

  it('por defecto la app lo abre sola', () => {
    montar();
    act(() => live.handlers!.onActiveChanged({ diagramId: DEL_AGENTE }));
    expect(window.location.pathname).toContain(DEL_AGENTE.replace('dg_', ''));
    expect(diagramStore.getState().agentNoticeId).toBeNull();
  });

  it('con "solo mostrar un aviso" se queda donde está y deja el aviso pendiente', () => {
    setCanvasPreferences({ onAgentChange: 'notice' });
    montar();
    act(() => live.handlers!.onActiveChanged({ diagramId: DEL_AGENTE }));
    expect(window.location.pathname).toContain(ABIERTO.replace('dg_', ''));
    expect(diagramStore.getState().agentNoticeId).toBe(DEL_AGENTE);
  });

  it('con "solo mostrar un aviso", el diagrama que ya está abierto no genera aviso', () => {
    setCanvasPreferences({ onAgentChange: 'notice' });
    montar();
    act(() => live.handlers!.onActiveChanged({ diagramId: ABIERTO }));
    expect(diagramStore.getState().agentNoticeId).toBeNull();
  });
});

describe('aviso del agente', () => {
  beforeEach(() => {
    diagramStore.setState({ ...diagramStore.getInitialState(), diagrams: [{ diagramId: DEL_AGENTE, type: 'class', title: 'Pedidos', revision: 1, updatedAt: '2026-10-20T10:00:00.000Z' }] });
    window.history.pushState(null, '', '/');
  });

  it('sin aviso pendiente no muestra nada', () => {
    render(<AgentNotice />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('nombra el diagrama y "Abrir" navega a él', async () => {
    diagramStore.getState().showAgentNotice(DEL_AGENTE);
    render(<AgentNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('El agente abrió «Pedidos»');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(window.location.pathname).toBe(`/d/pedidos-${DEL_AGENTE.replace('dg_', '')}`);
  });

  it('se puede cerrar y desaparece al abrir ese diagrama', async () => {
    diagramStore.getState().showAgentNotice(DEL_AGENTE);
    render(<AgentNotice />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => {
      diagramStore.getState().showAgentNotice(DEL_AGENTE);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => diagramStore.getState().open(DEL_AGENTE));
    expect(screen.queryByRole('status')).toBeNull();
    expect(diagramStore.getState().agentNoticeId).toBeNull();
  });
});
