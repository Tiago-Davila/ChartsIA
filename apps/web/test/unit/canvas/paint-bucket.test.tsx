import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramCanvas } from '../../../src/canvas/DiagramCanvas';
import { type StyleUpdate } from '../../../src/canvas/style-edits';
import { DiagramEditContext } from '../../../src/nodes/edit-context';

type Figura = { id: string; kind: string; name?: string; attributes?: never[]; operations?: never[]; style?: Record<string, unknown>; points?: { x: number; y: number }[]; strokeColor?: string; strokeWidth?: number };

const clase = (id: string, style?: Figura['style']): Figura => ({ id, kind: 'class', name: id, attributes: [], operations: [], ...(style ? { style } : {}) });

function renderCanvas(elements: Figura[], readOnly = false) {
  const updateStyles = vi.fn<(updates: StyleUpdate[]) => void>();
  const actions = { editText: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles, leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly: false };
  const nodes = elements.map((element, i) => ({ id: element.id, type: element.kind, position: { x: i * 200, y: 0 }, width: 120, height: 60, data: { element } }));
  render(
    <DiagramEditContext.Provider value={actions}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <DiagramCanvas diagramId="d" nodes={nodes as never} edges={[]} readOnly={readOnly} />
        </div>
      </ReactFlowProvider>
    </DiagramEditContext.Provider>,
  );
  return updateStyles;
}

const click = (id: string) => fireEvent.click(document.querySelector(`.react-flow__node[data-id="${id}"]`)!);

describe('balde de pintura', () => {
  it('sin el balde activo, un clic en una figura no cambia su estilo', () => {
    const updateStyles = renderCanvas([clase('A')]);
    click('A');
    expect(updateStyles).not.toHaveBeenCalled();
  });

  it('con el balde activo, cada clic pinta la figura con el color elegido sin abrir el panel de estilo', () => {
    const updateStyles = renderCanvas([clase('A', { fontSize: 20 }), clase('B')]);
    fireEvent.click(screen.getByRole('button', { name: 'Balde' }));
    fireEvent.change(screen.getByLabelText('Color del balde'), { target: { value: '#123456' } });
    click('A');
    click('B');
    expect(updateStyles).toHaveBeenNthCalledWith(1, [{ id: 'A', relation: false, style: { fontSize: 20, fillColor: '#123456' } }]);
    expect(updateStyles).toHaveBeenNthCalledWith(2, [{ id: 'B', relation: false, style: { fillColor: '#123456' } }]);
    expect(screen.queryByRole('region', { name: 'Estilo' })).toBeNull();
  });

  it('el balde y el lápiz no están activos a la vez', () => {
    renderCanvas([clase('A')]);
    fireEvent.click(screen.getByRole('button', { name: 'Balde' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(screen.getByRole('button', { name: 'Balde' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Lápiz' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('no pinta los trazos del lápiz', () => {
    const updateStyles = renderCanvas([{ id: 'T', kind: 'drawing', points: [{ x: 0, y: 0 }, { x: 40, y: 30 }], strokeColor: '#000000', strokeWidth: 2 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Balde' }));
    click('T');
    expect(updateStyles).not.toHaveBeenCalled();
  });

  it('en solo lectura no hay balde', () => {
    renderCanvas([clase('A')], true);
    expect(screen.queryByRole('button', { name: 'Balde' })).toBeNull();
  });
});
