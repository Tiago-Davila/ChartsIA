import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewDiagram } from '../../src/app/NewDiagram';

const proyectos = [{ id: 'pr_1', name: 'Tienda', createdAt: '2026-01-01' }];

describe('NewDiagram', () => {
  it('muestra solo el botón hasta que se pulsa', async () => {
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} />);
    expect(screen.queryByRole('form', { name: 'Nuevo diagrama' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    expect(screen.getByRole('form', { name: 'Nuevo diagrama' })).toBeInTheDocument();
  });

  it('ofrece todos los tipos de diagrama', async () => {
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    const opciones = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(opciones).toEqual(['class', 'c4-context', 'c4-container', 'c4-component', 'er']);
  });

  it('crea con el tipo y el título elegidos, recortado, y se cierra', async () => {
    const onCreate = vi.fn();
    render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'er');
    await userEvent.type(screen.getByLabelText('Título'), '  Tienda  ');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(onCreate).toHaveBeenCalledWith('er', 'Tienda', undefined);
    expect(screen.queryByRole('form', { name: 'Nuevo diagrama' })).toBeNull();
  });

  it('con un título vacío no deja crear', async () => {
    const onCreate = vi.fn();
    render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    await userEvent.type(screen.getByLabelText('Título'), '   {Enter}');
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('solo pide proyecto si hay proyectos y lo envía', async () => {
    const onCreate = vi.fn();
    const { unmount } = render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    expect(screen.queryByLabelText('Proyecto')).toBeNull();
    unmount();

    render(<NewDiagram projects={proyectos} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    await userEvent.selectOptions(screen.getByLabelText('Proyecto'), 'pr_1');
    await userEvent.type(screen.getByLabelText('Título'), 'En proyecto{Enter}');
    expect(onCreate).toHaveBeenCalledWith('class', 'En proyecto', 'pr_1');
  });

  it('Cancelar descarta lo escrito', async () => {
    const onCreate = vi.fn();
    render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    await userEvent.type(screen.getByLabelText('Título'), 'Algo');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo diagrama' }));
    expect(screen.getByLabelText('Título')).toHaveValue('');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('importa Mermaid con título y proyecto opcionales', async () => {
    const onImportMermaid = vi.fn().mockResolvedValue([]);
    render(<NewDiagram projects={proyectos} onCreate={vi.fn()} onImportMermaid={onImportMermaid} />);
    await userEvent.click(screen.getByRole('button', { name: 'Importar Mermaid' }));
    await userEvent.type(screen.getByLabelText('Mermaid classDiagram'), 'classDiagram\nclass Usuario');
    await userEvent.type(screen.getByLabelText('Título (opcional)'), ' Usuarios ');
    await userEvent.selectOptions(screen.getByLabelText('Proyecto'), 'pr_1');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onImportMermaid).toHaveBeenCalledWith('classDiagram\nclass Usuario', 'Usuarios', 'pr_1');
    expect(screen.queryByRole('form', { name: 'Importar Mermaid' })).toBeNull();
  });

  it('conserva el texto si falla la importación para que se pueda corregir', async () => {
    const onImportMermaid = vi.fn().mockResolvedValue(null);
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={onImportMermaid} />);
    await userEvent.click(screen.getByRole('button', { name: 'Importar Mermaid' }));
    const source = 'classDiagram\nclass';
    await userEvent.type(screen.getByLabelText('Mermaid classDiagram'), source);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByLabelText('Mermaid classDiagram')).toHaveValue(source);
    expect(screen.getByRole('form', { name: 'Importar Mermaid' })).toBeInTheDocument();
  });

  it('muestra aproximaciones del modelo cuando el import termina correctamente', async () => {
    const onImportMermaid = vi.fn().mockResolvedValue(['El lollipop se importó como realización.']);
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={onImportMermaid} />);
    await userEvent.click(screen.getByRole('button', { name: 'Importar Mermaid' }));
    await userEvent.type(screen.getByLabelText('Mermaid classDiagram'), 'classDiagram\nA ()-- B');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Diagrama importado con aproximaciones');
    expect(screen.getByRole('list', { name: 'Avisos de importación' })).toHaveTextContent('El lollipop se importó como realización.');
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });
});
