import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NameDialog } from '../../src/app/NameDialog';

const abrir = (props: Partial<Parameters<typeof NameDialog>[0]> = {}) => {
  const onConfirmar = vi.fn();
  const onCerrar = vi.fn();
  render(<NameDialog titulo="Nuevo proyecto" textoConfirmar="Crear" onConfirmar={onConfirmar} onCerrar={onCerrar} {...props} />);
  return { onConfirmar, onCerrar, campo: screen.getByLabelText('Nombre') };
};

describe('NameDialog', () => {
  it('es un diálogo modal titulado y enfoca el campo al abrir', () => {
    const { campo } = abrir();
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo proyecto' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(campo).toHaveFocus();
  });

  it('Enter confirma con el nombre sin espacios sobrantes', async () => {
    const { onConfirmar, campo } = abrir();
    await userEvent.type(campo, '  Tienda Norte  {Enter}');
    expect(onConfirmar).toHaveBeenCalledExactlyOnceWith('Tienda Norte');
  });

  it('usa el texto del botón de confirmar', () => {
    abrir({ titulo: 'Renombrar diagrama', textoConfirmar: 'Renombrar' });
    expect(screen.getByRole('button', { name: 'Renombrar' })).toBeInTheDocument();
  });

  it('Escape cancela sin confirmar', async () => {
    const { onConfirmar, onCerrar, campo } = abrir();
    await userEvent.type(campo, 'Algo{Escape}');
    expect(onCerrar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('Cancelar cierra sin confirmar', async () => {
    const { onConfirmar, onCerrar } = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCerrar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('un nombre vacío o de solo espacios deshabilita Crear y Enter no confirma', async () => {
    const { onConfirmar, campo } = abrir();
    const crear = screen.getByRole('button', { name: 'Crear' });
    expect(crear).toBeDisabled();
    await userEvent.type(campo, '   {Enter}');
    expect(onConfirmar).not.toHaveBeenCalled();
    await userEvent.type(campo, 'x');
    expect(crear).toBeEnabled();
  });

  it('arranca con el valor inicial, que se puede confirmar tal cual', async () => {
    const { onConfirmar, campo } = abrir({ valorInicial: 'Diagrama viejo' });
    expect(campo).toHaveValue('Diagrama viejo');
    await userEvent.type(campo, '{Enter}');
    expect(onConfirmar).toHaveBeenCalledWith('Diagrama viejo');
  });

  it('respeta el largo máximo del campo', () => {
    const { campo } = abrir({ maxLength: 5 });
    expect(campo).toHaveAttribute('maxLength', '5');
  });

  it('un clic en el fondo cierra, pero uno dentro de la ventana no', async () => {
    const { onCerrar, campo } = abrir();
    await userEvent.click(campo);
    expect(onCerrar).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.querySelector('.modal-overlay') as Element);
    expect(onCerrar).toHaveBeenCalledOnce();
  });
});
