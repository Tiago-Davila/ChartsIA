import { type Element } from '@chartsia/core/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FlowNodePanel } from '../../../src/canvas/FlowNodePanel';
import { DiagramEditContext, type DiagramEditActions } from '../../../src/nodes/edit-context';
import { renderFlow } from '../support/render-flow';

const nodo = (extra: Partial<Element> = {}): Element => ({ id: 'n', kind: 'flow-node', variant: 'file', name: 'orders.repository.ts', subtitle: 'src/orders/orders.repository.ts', ...extra }) as Element;

describe('nodo de flujo', () => {
  it('dibuja la tarjeta con el ícono, el título y el subtítulo', () => {
    const { container } = renderFlow([nodo()]);
    const shape = container.querySelector('[data-testid="shape-n"]')!;
    expect(shape.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(screen.getByText('orders.repository.ts')).toBeInTheDocument();
    expect(screen.getByText('src/orders/orders.repository.ts')).toBeInTheDocument();
  });

  it('tiene la entrada a la izquierda y la salida a la derecha, conectables', () => {
    const { container } = renderFlow([nodo()], [], { actions: { readOnly: false } as DiagramEditActions });
    expect(container.querySelector('.react-flow__handle-left.target')).not.toBeNull();
    expect(container.querySelector('.react-flow__handle-right.source')).not.toBeNull();
    expect(container.querySelector('.react-flow__handle-top')).toBeNull();
  });

  it('dibuja la conexión con el trazo de su tipo', () => {
    const { container } = renderFlow(
      [nodo({ id: 'a' } as Partial<Element>), nodo({ id: 'b' } as Partial<Element>)],
      [{ id: 'r', kind: 'flow-edge', source: 'a', target: 'b', flowType: 'event', route: [{ x: 0, y: 30 }, { x: 100, y: 30 }] }],
    );
    const line = container.querySelector('[data-testid="edge-r"] path')!;
    expect(line.getAttribute('stroke-dasharray')).toBe('8 4');
    expect(line.getAttribute('stroke')).toBe('#7c3aed');
  });
});

describe('panel del nodo de flujo', () => {
  const actions = (editText: DiagramEditActions['editText']) => ({ editText, readOnly: false }) as DiagramEditActions;
  const mostrar = (editText: DiagramEditActions['editText'], element = nodo()) =>
    render(
      <DiagramEditContext.Provider value={actions(editText)}>
        <FlowNodePanel element={element as Extract<Element, { kind: 'flow-node' }>} />
      </DiagramEditContext.Provider>,
    );

  it('cambia la variante', async () => {
    const editText = vi.fn();
    mostrar(editText);
    await userEvent.selectOptions(screen.getByLabelText('Variante'), 'database');
    expect(editText).toHaveBeenCalledWith('n', 'variant', 'database');
  });

  it('guarda el subtítulo con Enter y solo si cambió', async () => {
    const editText = vi.fn();
    mostrar(editText);
    const campo = screen.getByLabelText('Subtítulo');
    await userEvent.type(campo, '{Enter}');
    expect(editText).not.toHaveBeenCalled();
    await userEvent.clear(campo);
    await userEvent.type(campo, 'src/nuevo.ts{Enter}');
    expect(editText).toHaveBeenCalledWith('n', 'subtitle', 'src/nuevo.ts');
  });
});
