import { type Element } from '@chartsia/core/model';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type DiagramEditActions } from '../../../src/nodes/edit-context';
import { renderFlow } from '../support/render-flow';

const clase: Element = {
  id: 'A', kind: 'class', name: 'A',
  attributes: [{ name: 'x', type: 'int', visibility: '-' }],
  operations: [{ name: 'f', parameters: [], visibility: '+' }],
};

function acciones(readOnly = false, slot: string | null = 'attribute:0'): DiagramEditActions {
  return {
    editText: vi.fn(), addMember: vi.fn(async () => slot ?? undefined), removeMember: vi.fn(), resize: vi.fn(), updateRelation: vi.fn(),
    updateStyles: vi.fn(), leaveGroup: vi.fn(), ungroup: vi.fn(), groupInFrame: vi.fn(), readOnly,
  };
}

describe('botones de miembros', () => {
  it('un nodo seleccionado muestra agregar atributo y método, y quitar por miembro', () => {
    renderFlow([clase], [], { selected: ['A'], actions: acciones() });
    expect(screen.getByRole('button', { name: 'Agregar atributo' }).closest('.nodrag')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Agregar método' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar literal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Quitar - x: int' })).toHaveClass('nodrag');
    expect(screen.getByRole('button', { name: 'Quitar + f()' })).toBeInTheDocument();
  });

  it('los botones quedan fuera del SVG de la forma', () => {
    const { container } = renderFlow([clase], [], { selected: ['A'], actions: acciones() });
    expect(container.querySelector('[data-testid="shape-A"] button, [data-testid="shape-A"] foreignObject')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(4);
  });

  it('un enum también permite agregar literales', () => {
    renderFlow([{ id: 'E', kind: 'enum', name: 'E', literals: ['A', 'B'] }], [], { selected: ['E'], actions: acciones() });
    expect(screen.getByRole('button', { name: 'Agregar literal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar A' })).toBeInTheDocument();
  });

  it('sin selección o en solo lectura no hay botones', () => {
    const sinSeleccion = renderFlow([clase], [], { actions: acciones() });
    expect(screen.queryByRole('button', { name: 'Agregar atributo' })).toBeNull();
    sinSeleccion.unmount();
    renderFlow([clase], [], { selected: ['A'], actions: acciones(true) });
    expect(screen.queryByRole('button', { name: 'Agregar atributo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quitar/ })).toBeNull();
  });

  it('el último literal de un enum no se puede quitar', () => {
    renderFlow([{ id: 'E', kind: 'enum', name: 'E', literals: ['A'] }], [], { selected: ['E'], actions: acciones() });
    expect(screen.queryByRole('button', { name: 'Quitar A' })).toBeNull();
  });

  it('los botones llaman a las acciones del nodo', () => {
    const actions = acciones();
    renderFlow([clase], [], { selected: ['A'], actions });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar método' }));
    expect(actions.addMember).toHaveBeenCalledWith('A', 'operation');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar - x: int' }));
    expect(actions.removeMember).toHaveBeenCalledWith('A', 'attribute:0');
  });

  it('el miembro agregado queda en modo edición con su texto', async () => {
    renderFlow([clase], [], { selected: ['A'], actions: acciones() });
    expect(screen.queryByRole('combobox', { name: 'Editar texto' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar atributo' }));
    expect(await screen.findByRole('combobox', { name: 'Editar texto' })).toHaveValue('- x: int');
  });

  it('si el hub rechaza el agregado no se abre ningún editor', async () => {
    renderFlow([clase], [], { selected: ['A'], actions: acciones(false, null) });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar atributo' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole('combobox', { name: 'Editar texto' })).toBeNull();
  });
});
