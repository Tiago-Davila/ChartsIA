import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';
import { DEFAULT_CANVAS_PREFERENCES, setCanvasPreferences } from '../../src/app/canvas-preferences';
import { diagramStore } from '../../src/state/diagram-store';

// La app no habla con ningún hub: el cliente de la API no responde y el canal en vivo no hace nada.
vi.mock('../../src/state/clients', () => ({
  api: {
    listDiagrams: () => new Promise(() => {}),
    listAgents: () => new Promise(() => {}),
    getHub: () => new Promise(() => {}),
    getDiagram: () => new Promise(() => {}),
    activate: () => new Promise(() => {}),
  },
}));
vi.mock('../../src/state/live-client', () => ({ createLiveClient: () => ({ close: () => {}, subscribe: () => {}, reconnect: () => {} }) }));

const ID = 'dg_aaaaaaaaaaaa';
const diagram = { id: ID, type: 'class' as const, title: 'T', revision: 2, createdAt: '', updatedAt: '2026-10-20T10:00:00.000Z', elements: [], relations: [] };
const raiz = () => document.querySelector('.app-root')!;

/** Abre un diagrama que acaba de cambiar el agente y simula que el sistema pide (o no) menos movimiento. */
function abrirConCambioDelAgente(sistemaReduce: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: sistemaReduce, addEventListener: () => {}, removeEventListener: () => {} }));
  window.history.pushState(null, '', `/d/${ID}`);
  diagramStore.setState({ ...diagramStore.getInitialState(), listLoaded: true, openDiagramId: ID, diagram, lastOrigin: 'agent' });
  render(<App />);
}

describe('animaciones de los cambios del agente', () => {
  beforeEach(() => {
    setCanvasPreferences(DEFAULT_CANVAS_PREFERENCES);
  });
  afterEach(() => {
    setCanvasPreferences(DEFAULT_CANVAS_PREFERENCES);
    localStorage.clear();
    window.history.pushState(null, '', '/');
    vi.unstubAllGlobals();
  });

  it('por defecto animan', () => {
    abrirConCambioDelAgente(false);
    expect(raiz()).toHaveClass('animate-agent');
  });

  it('por defecto respetan prefers-reduced-motion', () => {
    abrirConCambioDelAgente(true);
    expect(raiz()).not.toHaveClass('animate-agent');
  });

  it('"Normales" animan aunque el sistema pida menos movimiento', () => {
    setCanvasPreferences({ animations: 'normal' });
    abrirConCambioDelAgente(true);
    expect(raiz()).toHaveClass('animate-agent');
  });

  it('"Reducidas" no animan, y el cambio se nota al instante', () => {
    abrirConCambioDelAgente(false);
    expect(raiz()).toHaveClass('animate-agent');
    act(() => setCanvasPreferences({ animations: 'reduced' }));
    expect(raiz()).not.toHaveClass('animate-agent');
  });
});
