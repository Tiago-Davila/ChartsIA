import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramCanvas } from '../../../src/canvas/DiagramCanvas';
import { DiagramEditContext } from '../../../src/nodes/edit-context';

function renderCanvas() {
  const actions = { editText: vi.fn(), addMember: vi.fn(), removeMember: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(), updateStyles: vi.fn(), leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly: false };
  render(
    <DiagramEditContext.Provider value={actions}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <DiagramCanvas diagramId="d" nodes={[]} edges={[]} />
        </div>
      </ReactFlowProvider>
    </DiagramEditContext.Provider>,
  );
}

const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('herramienta de selección', () => {
  it('al abrir el lienzo, la selección está activa y las demás apagadas', () => {
    renderCanvas();
    expect(pressed('Selección')).toBe('true');
    expect(pressed('Lápiz')).toBe('false');
    expect(pressed('Marcador')).toBe('false');
    expect(pressed('Balde')).toBe('false');
  });

  it('elegir selección apaga el lápiz', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Lápiz' }));
    expect(pressed('Lápiz')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Selección' }));
    expect(pressed('Lápiz')).toBe('false');
    expect(pressed('Selección')).toBe('true');
    expect(screen.queryByLabelText('Color del lápiz')).toBeNull();
  });

  it('elegir selección apaga el balde y su color', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Balde' }));
    expect(screen.getByLabelText('Color del balde')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Selección' }));
    expect(pressed('Balde')).toBe('false');
    expect(screen.queryByLabelText('Color del balde')).toBeNull();
  });

  it('pulsar la herramienta activa vuelve a la selección', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Marcador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcador' }));
    expect(pressed('Marcador')).toBe('false');
    expect(pressed('Selección')).toBe('true');
  });
});
