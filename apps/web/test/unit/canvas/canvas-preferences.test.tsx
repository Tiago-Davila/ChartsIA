import { act, render, waitFor } from '@testing-library/react';
import { ReactFlowProvider, type ReactFlowProps } from '@xyflow/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CANVAS_PREFERENCES, setCanvasPreferences } from '../../../src/app/canvas-preferences';
import { DiagramCanvas } from '../../../src/canvas/DiagramCanvas';
import { DiagramEditContext } from '../../../src/nodes/edit-context';

// Guarda las propiedades con que el lienzo crea React Flow, para ver el ajuste a la cuadrícula.
const props = vi.hoisted(() => ({ last: undefined as ReactFlowProps | undefined }));
vi.mock('@xyflow/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...original,
    ReactFlow: (p: ReactFlowProps) => {
      props.last = p;
      return <original.ReactFlow {...p} />;
    },
  };
});

const actions = { editText: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles: vi.fn(), leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly: false };
// Un nodo ya medido, para que React Flow lo dé por inicializado y encuadre.
const node = { id: 'A', type: 'default', position: { x: 0, y: 0 }, width: 100, height: 50, measured: { width: 100, height: 50 }, data: {}, handles: [] };

function renderCanvas(diagramId = 'd') {
  return render(
    <DiagramEditContext.Provider value={actions}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <DiagramCanvas diagramId={diagramId} nodes={[node]} edges={[]} />
        </div>
      </ReactFlowProvider>
    </DiagramEditContext.Provider>,
  );
}

// jsdom no mide nada y React Flow necesita el tamaño del lienzo para encuadrar.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 1200 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 800 });
});

const hay = (selector: string) => document.querySelector(selector) !== null;
const viewport = () => (document.querySelector('.react-flow__viewport') as HTMLElement).style.transform;
const zoom = () => Number(/scale\(([\d.]+)\)/.exec(viewport())?.[1]);

describe('preferencias del lienzo aplicadas al lienzo', () => {
  afterEach(() => {
    setCanvasPreferences(DEFAULT_CANVAS_PREFERENCES);
    localStorage.clear();
    props.last = undefined;
  });

  it('por defecto muestra cuadrícula de 20, minimapa y controles, y no ajusta al mover', () => {
    renderCanvas();
    expect(hay('.react-flow__background')).toBe(true);
    expect(hay('.react-flow__minimap')).toBe(true);
    expect(hay('.react-flow__controls')).toBe(true);
    expect(props.last?.snapToGrid).toBe(false);
    expect(props.last?.snapGrid).toEqual([20, 20]);
  });

  it('ocultar cuadrícula, minimapa y controles los quita al instante, sin recargar', () => {
    renderCanvas();
    act(() => setCanvasPreferences({ grid: false }));
    expect(hay('.react-flow__background')).toBe(false);
    act(() => setCanvasPreferences({ minimap: false }));
    expect(hay('.react-flow__minimap')).toBe(false);
    act(() => setCanvasPreferences({ zoomControls: false }));
    expect(hay('.react-flow__controls')).toBe(false);
    act(() => setCanvasPreferences({ grid: true, minimap: true, zoomControls: true }));
    expect(hay('.react-flow__background') && hay('.react-flow__minimap') && hay('.react-flow__controls')).toBe(true);
  });

  it('el tamaño de la cuadrícula se usa para dibujarla y para ajustar al mover', () => {
    setCanvasPreferences({ gridSize: 40, snapToGrid: true });
    renderCanvas();
    expect(props.last?.snapToGrid).toBe(true);
    expect(props.last?.snapGrid).toEqual([40, 40]);
    expect(document.querySelector('.react-flow__background pattern')?.getAttribute('width')).toBe('40');
  });

  it('al abrir un diagrama lo ajusta a la pantalla, o lo muestra al 100 % si así se pidió', async () => {
    const ajustado = renderCanvas();
    await waitFor(() => expect(zoom()).toBeGreaterThan(1));
    ajustado.unmount();
    setCanvasPreferences({ onOpen: 'actual' });
    renderCanvas();
    // Al 100 % el diagrama queda centrado: el nodo de 100 px en un lienzo de 1200 px empieza en x = 550.
    await waitFor(() => expect(viewport()).toContain('translate(550px'));
    expect(zoom()).toBe(1);
  });
});
