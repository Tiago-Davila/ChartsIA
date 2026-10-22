import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { StylePanel } from '../../../src/canvas/StylePanel';
import { type StyleTarget, type StyleUpdate } from '../../../src/canvas/style-edits';
import { SelectionPanel } from '../../../src/canvas/SelectionPanel';
import { DiagramEditContext } from '../../../src/nodes/edit-context';

function renderPanel(targets: StyleTarget[]) {
  const updateStyles = vi.fn<(updates: StyleUpdate[]) => void>();
  const actions = { editText: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles, leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly: false };
  render(
    <DiagramEditContext.Provider value={actions}>
      <ReactFlowProvider>
        <ReactFlow nodes={[]} edges={[]}>
          <StylePanel targets={targets} />
        </ReactFlow>
      </ReactFlowProvider>
    </DiagramEditContext.Provider>,
  );
  return updateStyles;
}

const clase = (id: string, style?: StyleTarget['style']): StyleTarget => ({ id, relation: false, style });

describe('StylePanel', () => {
  it('no aparece sin selección', () => {
    renderPanel([]);
    expect(screen.queryByRole('region', { name: 'Estilo' })).toBeNull();
  });

  it('un color de la paleta manda el estilo completo con el campo cambiado', () => {
    const updateStyles = renderPanel([clase('A', { fontSize: 20 })]);
    fireEvent.click(screen.getByRole('button', { name: 'Relleno: Rojo' }));
    expect(updateStyles).toHaveBeenCalledWith([{ id: 'A', relation: false, style: { fontSize: 20, fillColor: '#dc2626' } }]);
  });

  it('el selector libre confirma el color al emitir "change"', () => {
    const updateStyles = renderPanel([clase('A')]);
    fireEvent.change(screen.getByLabelText('Color de borde libre'), { target: { value: '#123456' } });
    expect(updateStyles).toHaveBeenCalledWith([{ id: 'A', relation: false, style: { borderColor: '#123456' } }]);
  });

  it('marca el color actual de la paleta', () => {
    renderPanel([clase('A', { fontColor: '#2563eb' })]);
    expect(screen.getByRole('button', { name: 'Color de fuente: Azul' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Color de fuente: Rojo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('la familia y el tamaño de fuente se cambian con sus controles', () => {
    const updateStyles = renderPanel([clase('A')]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Familia de fuente' }), { target: { value: 'serif' } });
    expect(updateStyles).toHaveBeenLastCalledWith([{ id: 'A', relation: false, style: { fontFamily: 'serif' } }]);
    const size = screen.getByRole('spinbutton', { name: 'Tamaño de fuente' });
    fireEvent.change(size, { target: { value: '99' } });
    fireEvent.keyDown(size, { key: 'Enter' });
    expect(updateStyles).toHaveBeenLastCalledWith([{ id: 'A', relation: false, style: { fontSize: 48 } }]);
  });

  it('con varios seleccionados aplica el cambio a todos en un solo lote', () => {
    const updateStyles = renderPanel([clase('A', { fontSize: 12 }), clase('B'), { id: 'r1', relation: true }]);
    fireEvent.click(screen.getByRole('button', { name: 'Color de borde: Verde' }));
    expect(updateStyles).toHaveBeenCalledTimes(1);
    expect(updateStyles.mock.calls[0]![0]).toEqual([
      { id: 'A', relation: false, style: { fontSize: 12, borderColor: '#16a34a' } },
      { id: 'B', relation: false, style: { borderColor: '#16a34a' } },
      { id: 'r1', relation: true, style: { borderColor: '#16a34a' } },
    ]);
  });

  it('restablecer borra el estilo solo de quienes lo tienen', () => {
    const updateStyles = renderPanel([clase('A', { fillColor: '#ffffff' }), clase('B')]);
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer estilo' }));
    expect(updateStyles).toHaveBeenCalledWith([{ id: 'A', relation: false, style: null }]);
  });

  it('restablecer está desactivado sin estilo', () => {
    renderPanel([clase('A')]);
    expect(screen.getByRole('button', { name: 'Restablecer estilo' })).toBeDisabled();
  });

  it('para flechas el primer color se llama "Color de línea"', () => {
    renderPanel([{ id: 'r1', relation: true }]);
    expect(screen.getByRole('group', { name: 'Color de línea' })).toBeInTheDocument();
  });
});

describe('SelectionPanel', () => {
  it('permite agrupar nodos conectados aunque también haya una relación seleccionada', () => {
    const groupInFrame = vi.fn();
    const actions = { editText: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles: vi.fn(), leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame, readOnly: false };
    const nodes = [
      { id: 'A', position: { x: 0, y: 0 }, selected: true, data: { element: { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] } } },
      { id: 'B', position: { x: 100, y: 0 }, selected: true, data: { element: { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] } } },
    ];
    const edges = [{ id: 'r1', source: 'A', target: 'B', selected: true, data: { relation: { id: 'r1', kind: 'association', source: 'A', target: 'B' } } }];
    render(
      <DiagramEditContext.Provider value={actions}>
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges}>
            <SelectionPanel nodes={nodes} edges={edges} onEditEdge={vi.fn()} />
          </ReactFlow>
        </ReactFlowProvider>
      </DiagramEditContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar en marco' }));
    expect(groupInFrame).toHaveBeenCalledWith(['A', 'B']);
  });
});
