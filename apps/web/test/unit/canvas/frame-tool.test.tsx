import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DiagramCanvas } from '../../../src/canvas/DiagramCanvas';
import { DiagramEditContext } from '../../../src/nodes/edit-context';

// jsdom no implementa la captura de punteros que usa el lienzo al dibujar.
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

function renderCanvas(onAddFrame = vi.fn()) {
  const actions = { editText: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles: vi.fn(), leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly: false };
  render(
    <DiagramEditContext.Provider value={actions}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <DiagramCanvas diagramId="d" nodes={[]} edges={[]} onAddFrame={onAddFrame} />
        </div>
      </ReactFlowProvider>
    </DiagramEditContext.Provider>,
  );
  return onAddFrame;
}

/** Evento del puntero sobre el lienzo, con su posición de pantalla. */
function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) {
  act(() => {
    document.querySelector('.react-flow__pane')!.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  });
}

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('herramienta Marco', () => {
  it('con la herramienta activa, arrastrar muestra el rectángulo y al soltar crea el marco y vuelve a la selección', () => {
    const onAddFrame = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Marco' }));
    expect(pressed('Marco')).toBe('true');

    pointer('pointerdown', 50, 60);
    pointer('pointermove', 150, 120);
    expect(document.querySelector('.diagram-canvas__frame')).not.toBeNull();
    pointer('pointerup', 250, 160);

    expect(onAddFrame).toHaveBeenCalledWith({ x: 50, y: 60, width: 200, height: 100 });
    expect(document.querySelector('.diagram-canvas__frame')).toBeNull();
    expect(pressed('Marco')).toBe('false');
    expect(pressed('Selección')).toBe('true');
  });

  it('arrastrar hacia arriba y a la izquierda crea el marco desde la esquina correcta', () => {
    const onAddFrame = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Marco' }));
    pointer('pointerdown', 250, 160);
    pointer('pointerup', 50, 60);
    expect(onAddFrame).toHaveBeenCalledWith({ x: 50, y: 60, width: 200, height: 100 });
  });

  it('un arrastre de menos de 10px no crea marco, pero la herramienta vuelve a la selección', () => {
    const onAddFrame = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Marco' }));
    pointer('pointerdown', 50, 60);
    pointer('pointerup', 55, 63);
    expect(onAddFrame).not.toHaveBeenCalled();
    expect(pressed('Selección')).toBe('true');
  });

  it('sin la herramienta, arrastrar no crea marco', () => {
    const onAddFrame = renderCanvas();
    pointer('pointerdown', 50, 60);
    pointer('pointermove', 150, 120);
    pointer('pointerup', 250, 160);
    expect(onAddFrame).not.toHaveBeenCalled();
    expect(document.querySelector('.diagram-canvas__frame')).toBeNull();
  });
});
