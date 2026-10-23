import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextBlockEditor } from '../../../src/nodes/TextBlockEditor';

function renderEditor(value = '# Hola') {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(<TextBlockEditor value={value} width={200} height={80} onCommit={onCommit} onCancel={onCancel} />);
  return { field: screen.getByLabelText('Editar bloque de texto') as HTMLTextAreaElement, onCommit, onCancel };
}

describe('editor del bloque de texto', () => {
  it('abre con el markdown actual seleccionado y enfocado', () => {
    const { field } = renderEditor('# Hola');
    expect(field.value).toBe('# Hola');
    expect(document.activeElement).toBe(field);
  });

  it('salir del campo confirma el texto cambiado', () => {
    const { field, onCommit } = renderEditor();
    fireEvent.change(field, { target: { value: '## Nuevo **texto**' } });
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledWith('## Nuevo **texto**');
  });

  it('Enter agrega una línea y no confirma', () => {
    const { field, onCommit } = renderEditor('uno');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter confirma una sola vez aunque el blur llegue después', () => {
    const { field, onCommit } = renderEditor();
    fireEvent.change(field, { target: { value: 'otro' } });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('otro');
  });

  it('Escape cancela y no guarda los cambios', () => {
    const { field, onCommit, onCancel } = renderEditor();
    fireEvent.change(field, { target: { value: 'descartar' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    fireEvent.blur(field);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('un texto vacío o sin cambios no se guarda', () => {
    const { field, onCommit, onCancel } = renderEditor('# Hola');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.blur(field);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
