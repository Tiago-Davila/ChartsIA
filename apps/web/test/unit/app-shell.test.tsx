import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, type AppShellProps } from '../../src/app/AppShell';

const base: AppShellProps = {
  diagrams: [
    { diagramId: 'dg_aaaaaaaaaaaa', type: 'class', title: 'Biblioteca', revision: 3, updatedAt: '2026-10-20T10:00:00.000Z' },
    { diagramId: 'dg_bbbbbbbbbbbb', type: 'c4-container', title: 'Tienda', revision: 1, updatedAt: '2026-10-19T10:00:00.000Z' },
  ],
  projects: [],
  activeDiagramId: 'dg_bbbbbbbbbbbb',
  connection: 'connected',
  nodes: [],
  edges: [],
  origin: 'http://127.0.0.1:3333',
  onConfig: vi.fn(),
  onCloseConfig: vi.fn(),
  onOpen: vi.fn(),
  onMoveDiagram: vi.fn(),
  onNewProject: vi.fn(),
  onExport: vi.fn(),
};

const renderShell = (props: Partial<AppShellProps> = {}) =>
  render(
    <ReactFlowProvider>
      <AppShell {...base} {...props} />
    </ReactFlowProvider>,
  );

describe('AppShell', () => {
  it('sin diagrama abierto muestra el estado vacío con un enlace a la configuración', async () => {
    const onConfig = vi.fn();
    renderShell({ onConfig });
    expect(screen.getByRole('heading', { name: 'Conecta tu agente' })).toBeInTheDocument();
    expect(screen.queryByText(/claude mcp add/)).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'la configuración' }));
    expect(onConfig).toHaveBeenCalled();
  });

  it('el engranaje abre la configuración y la pantalla permite volver', async () => {
    const onConfig = vi.fn();
    const onCloseConfig = vi.fn();
    renderShell({ onConfig, onCloseConfig, configOpen: true });
    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    expect(onConfig).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← Volver al lienzo' }));
    expect(onCloseConfig).toHaveBeenCalled();
  });

  it('lista los diagramas, marca el activo y permite abrir cualquiera', async () => {
    const onOpen = vi.fn();
    renderShell({ onOpen });
    expect(screen.getByText('C4 · Contenedores', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Activo').closest('button')).toHaveTextContent('Tienda');
    await userEvent.click(screen.getByText('Biblioteca'));
    expect(onOpen).toHaveBeenCalledWith('dg_aaaaaaaaaaaa');
  });

  it('el menú ⋯ no abre el diagrama, excluye el proyecto actual y ofrece quitar', async () => {
    const onOpen = vi.fn();
    const onMoveDiagram = vi.fn();
    const projects = [
      { id: 'pr_1', name: 'Uno', createdAt: '' },
      { id: 'pr_2', name: 'Dos', createdAt: '' },
    ];
    const diagrams = [{ ...base.diagrams[0]!, projectId: 'pr_1' }, base.diagrams[1]!];
    renderShell({ onOpen, onMoveDiagram, projects, diagrams });
    await userEvent.click(screen.getByRole('button', { name: 'Opciones de Biblioteca' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: 'Mover a Uno' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Quitar del proyecto' }));
    expect(onMoveDiagram).toHaveBeenCalledWith('dg_aaaaaaaaaaaa', null);
    // Sin proyecto no ofrece quitar.
    await userEvent.click(screen.getByRole('button', { name: 'Opciones de Tienda' }));
    expect(screen.queryByRole('menuitem', { name: 'Quitar del proyecto' })).toBeNull();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover a Dos' }));
    expect(onMoveDiagram).toHaveBeenCalledWith('dg_bbbbbbbbbbbb', 'pr_2');
  });

  it('"Nuevo proyecto…" no llama al hub si el nombre está vacío o se cancela', async () => {
    const onNewProject = vi.fn();
    const prompt = vi.spyOn(window, 'prompt');
    renderShell({ onNewProject });
    for (const respuesta of [null, '   ']) {
      prompt.mockReturnValueOnce(respuesta);
      await userEvent.click(screen.getByRole('button', { name: 'Opciones de Biblioteca' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Nuevo proyecto…' }));
    }
    expect(onNewProject).not.toHaveBeenCalled();
    prompt.mockReturnValueOnce(' Nuevo ');
    await userEvent.click(screen.getByRole('button', { name: 'Opciones de Biblioteca' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nuevo proyecto…' }));
    expect(onNewProject).toHaveBeenCalledWith('dg_aaaaaaaaaaaa', 'Nuevo');
    prompt.mockRestore();
  });

  it('Escape cierra el menú', async () => {
    renderShell();
    const boton = screen.getByRole('button', { name: 'Opciones de Biblioteca' });
    await userEvent.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('con diagrama abierto muestra toolbar y exportación', async () => {
    const onExport = vi.fn();
    renderShell({
      onExport,
      diagram: { id: 'dg_aaaaaaaaaaaa', type: 'class', title: 'Biblioteca', revision: 3, createdAt: '', updatedAt: '', elements: [], relations: [] },
    });
    expect(screen.getByRole('heading', { name: /Biblioteca/ })).toBeInTheDocument();
    await userEvent.click(screen.getByText('Exportar'));
    await userEvent.click(screen.getByRole('menuitem', { name: /draw\.io/ }));
    expect(onExport).toHaveBeenCalledWith('drawio');
  });

  it('muestra el estado de la conexión', () => {
    renderShell({ connection: 'reconnecting' });
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando');
  });

  it('la leyenda C4 solo aparece en diagramas C4', () => {
    renderShell({
      diagram: { id: 'dg_bbbbbbbbbbbb', type: 'c4-container', title: 'Tienda', revision: 1, createdAt: '', updatedAt: '',
        elements: [{ id: 'p', kind: 'person', name: 'Cliente' }, { id: 'x', kind: 'software-system', name: 'Pagos', external: true }], relations: [] },
    });
    const legend = screen.getByRole('complementary', { name: 'Leyenda C4' });
    expect(legend).toHaveTextContent('Persona');
    expect(legend).toHaveTextContent('Externo');
  });
});
