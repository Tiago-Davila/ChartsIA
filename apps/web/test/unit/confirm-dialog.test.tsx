import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../src/app/ConfirmDialog';

const abrir = () => {
  const onConfirmar = vi.fn();
  const onCerrar = vi.fn();
  render(<ConfirmDialog titulo="Eliminar diagrama" mensaje="Se borra para siempre." textoConfirmar="Eliminar" onConfirmar={onConfirmar} onCerrar={onCerrar} />);
  return { onConfirmar, onCerrar };
};

describe('ConfirmDialog', () => {
  it('es un diálogo modal con el mensaje y enfoca Cancelar, la opción segura', () => {
    abrir();
    expect(screen.getByRole('dialog', { name: 'Eliminar diagrama' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Se borra para siempre.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Eliminar confirma una sola vez', async () => {
    const { onConfirmar, onCerrar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onConfirmar).toHaveBeenCalledOnce();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('Cancelar y Escape cierran sin confirmar', async () => {
    const { onConfirmar, onCerrar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.keyboard('{Escape}');
    expect(onCerrar).toHaveBeenCalledTimes(2);
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});
