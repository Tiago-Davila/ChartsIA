import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteProjectDialog, textoDiagramas } from '../../src/app/DeleteProjectDialog';

const abrir = (diagramas: number) => {
  const onConfirmar = vi.fn();
  const onCerrar = vi.fn();
  render(<DeleteProjectDialog nombre="Tienda" diagramas={diagramas} onConfirmar={onConfirmar} onCerrar={onCerrar} />);
  return { onConfirmar, onCerrar };
};

describe('textoDiagramas', () => {
  it('dice qué pasa con los diagramas según la cantidad', () => {
    expect(textoDiagramas(0)).toBe('El proyecto no tiene diagramas.');
    expect(textoDiagramas(1)).toBe('Su diagrama pasa a «Sin proyecto».');
    expect(textoDiagramas(3)).toBe('Sus 3 diagramas pasan a «Sin proyecto».');
  });
});

describe('DeleteProjectDialog', () => {
  it('es un diálogo titulado con la advertencia y la cantidad de diagramas', () => {
    abrir(3);
    expect(screen.getByRole('dialog', { name: 'Eliminar proyecto' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Se elimina el proyecto «Tienda»\. Sus 3 diagramas pasan a «Sin proyecto»\. Los diagramas no se borran\./)).toBeInTheDocument();
  });

  it('Cancelar cierra sin eliminar', async () => {
    const { onConfirmar, onCerrar } = abrir(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCerrar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('Eliminar confirma una sola vez al mantenerlo pulsado, y soltarlo antes no elimina', () => {
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'] });
    try {
      const { onConfirmar } = abrir(1);
      const eliminar = screen.getByRole('button', { name: 'Mantener para eliminar' });
      fireEvent.keyDown(eliminar, { key: 'Enter' });
      act(() => vi.advanceTimersByTime(500));
      fireEvent.keyUp(eliminar, { key: 'Enter' });
      act(() => vi.advanceTimersByTime(2000));
      expect(onConfirmar).not.toHaveBeenCalled();

      fireEvent.keyDown(eliminar, { key: 'Enter' });
      act(() => vi.advanceTimersByTime(1700));
      fireEvent.keyUp(eliminar, { key: 'Enter' });
      expect(onConfirmar).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('Escape cierra sin eliminar', async () => {
    const { onConfirmar, onCerrar } = abrir(0);
    await userEvent.keyboard('{Escape}');
    expect(onCerrar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('enfoca Cancelar al abrir, para que Enter no elimina por accidente', () => {
    abrir(2);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });
});
