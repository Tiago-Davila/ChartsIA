import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramCanvas } from '../../../src/canvas/DiagramCanvas';
import { DiagramEditContext } from '../../../src/nodes/edit-context';

function renderCanvas(onAddText = vi.fn()) {
  const actions = { editText: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles: vi.fn(), leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly: false };
  render(
    <DiagramEditContext.Provider value={actions}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <DiagramCanvas diagramId="d" nodes={[]} edges={[]} onAddText={onAddText} />
        </div>
      </ReactFlowProvider>
    </DiagramEditContext.Provider>,
  );
  return onAddText;
}

/** Pulsación del puntero sobre el lienzo, con su posición de pantalla. */
function press(target: Element, x: number, y: number) {
  act(() => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  });
}

describe('herramienta Texto', () => {
  it('con la herramienta activa, un clic en el lienzo crea un bloque en ese punto y vuelve a la selección', () => {
    const onAddText = renderCanvas();
    const tool = screen.getByRole('button', { name: 'Texto' });
    fireEvent.click(tool);
    expect(tool).toHaveAttribute('aria-pressed', 'true');

    press(document.querySelector('.react-flow__pane')!, 50, 60);

    expect(onAddText).toHaveBeenCalledWith({ x: 50, y: 60 });
    expect(tool).toHaveAttribute('aria-pressed', 'false');
  });

  it('sin la herramienta, el clic no crea nada', () => {
    const onAddText = renderCanvas();
    press(document.querySelector('.react-flow__pane')!, 50, 60);
    expect(onAddText).not.toHaveBeenCalled();
  });

  it('pulsar el botón otra vez desactiva la herramienta', () => {
    const onAddText = renderCanvas();
    const tool = screen.getByRole('button', { name: 'Texto' });
    fireEvent.click(tool);
    fireEvent.click(tool);
    press(document.querySelector('.react-flow__pane')!, 50, 60);
    expect(onAddText).not.toHaveBeenCalled();
  });
});
