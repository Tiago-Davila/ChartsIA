import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewDiagram } from '../../src/app/NewDiagram';

const proyectos = [{ id: 'pr_1', name: 'Tienda', createdAt: '2026-01-01' }];

/** Abre el menú "+ Nuevo" y elige una opción. */
const elegir = async (opcion: 'Diagrama en blanco' | 'Importar Mermaid') => {
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await userEvent.click(screen.getByRole('menuitem', { name: opcion }));
};

describe('NewDiagram', () => {
  it('muestra solo el botón hasta que se elige una opción, y el formulario va en una ventana', async () => {
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} />);
    expect(screen.queryByRole('form', { name: 'Nuevo diagrama' })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    await elegir('Diagrama en blanco');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Nuevo diagrama' })).toContainElement(screen.getByRole('form', { name: 'Nuevo diagrama' }));
    expect(screen.getByLabelText('Título')).toHaveFocus();
  });

  it('el menú se recorre con las flechas y Escape lo cierra devolviendo el foco al botón', async () => {
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} />);
    const boton = screen.getByRole('button', { name: 'Nuevo' });
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    screen.getByRole('menuitem', { name: 'Diagrama en blanco' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Importar Mermaid' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(boton).toHaveFocus();
  });

  it('un clic fuera cierra el menú sin abrir nada', async () => {
    render(<><NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} /><p>afuera</p></>);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
    await userEvent.click(screen.getByText('afuera'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ofrece todos los tipos de diagrama', async () => {
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={vi.fn()} />);
    await elegir('Diagrama en blanco');
    const opciones = screen.getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(opciones).toEqual(['class', 'c4-context', 'c4-container', 'c4-component', 'er', 'nosql']);
  });

  it('crea con el tipo y el título elegidos, recortado, y se cierra', async () => {
    const onCreate = vi.fn();
    render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await elegir('Diagrama en blanco');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'er');
    await userEvent.type(screen.getByLabelText('Título'), '  Tienda  ');
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(onCreate).toHaveBeenCalledWith('er', 'Tienda', undefined);
    expect(screen.queryByRole('form', { name: 'Nuevo diagrama' })).toBeNull();
  });

  it('con un título vacío no deja crear', async () => {
    const onCreate = vi.fn();
    render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await elegir('Diagrama en blanco');
    await userEvent.type(screen.getByLabelText('Título'), '   {Enter}');
    expect(screen.getByRole('button', { name: 'Crear' })).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('solo pide proyecto si hay proyectos y lo envía', async () => {
    const onCreate = vi.fn();
    const { unmount } = render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await elegir('Diagrama en blanco');
    expect(screen.queryByLabelText('Proyecto')).toBeNull();
    unmount();

    render(<NewDiagram projects={proyectos} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await elegir('Diagrama en blanco');
    await userEvent.selectOptions(screen.getByLabelText('Proyecto'), 'pr_1');
    await userEvent.type(screen.getByLabelText('Título'), 'En proyecto{Enter}');
    expect(onCreate).toHaveBeenCalledWith('class', 'En proyecto', 'pr_1');
  });

  it('Cancelar descarta lo escrito', async () => {
    const onCreate = vi.fn();
    render(<NewDiagram projects={[]} onCreate={onCreate} onImportMermaid={vi.fn()} />);
    await elegir('Diagrama en blanco');
    await userEvent.type(screen.getByLabelText('Título'), 'Algo');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await elegir('Diagrama en blanco');
    expect(screen.getByLabelText('Título')).toHaveValue('');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('importa Mermaid con título y proyecto opcionales', async () => {
    const onImportMermaid = vi.fn().mockResolvedValue([]);
    render(<NewDiagram projects={proyectos} onCreate={vi.fn()} onImportMermaid={onImportMermaid} />);
    await elegir('Importar Mermaid');
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
    await elegir('Importar Mermaid');
    const source = 'classDiagram\nclass';
    await userEvent.type(screen.getByLabelText('Mermaid classDiagram'), source);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByLabelText('Mermaid classDiagram')).toHaveValue(source);
    expect(screen.getByRole('form', { name: 'Importar Mermaid' })).toBeInTheDocument();
  });

  it('muestra aproximaciones del modelo cuando el import termina correctamente', async () => {
    const onImportMermaid = vi.fn().mockResolvedValue(['El lollipop se importó como realización.']);
    render(<NewDiagram projects={[]} onCreate={vi.fn()} onImportMermaid={onImportMermaid} />);
    await elegir('Importar Mermaid');
    await userEvent.type(screen.getByLabelText('Mermaid classDiagram'), 'classDiagram\nA ()-- B');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Diagrama importado con aproximaciones');
    expect(screen.getByRole('list', { name: 'Avisos de importación' })).toHaveTextContent('El lollipop se importó como realización.');
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });
});
