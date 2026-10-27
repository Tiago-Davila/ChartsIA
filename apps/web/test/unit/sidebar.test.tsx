import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell, type AppShellProps } from '../../src/app/AppShell';
import { clampWidth } from '../../src/app/ResizeHandle';

const base: AppShellProps = {
  diagrams: [
    { diagramId: 'dg_aaaaaaaaaaaa', type: 'class', title: 'Biblioteca', revision: 3, updatedAt: '2026-10-20T10:00:00.000Z', projectId: 'pr_1' },
    { diagramId: 'dg_bbbbbbbbbbbb', type: 'c4-container', title: 'Tienda', revision: 1, updatedAt: '2026-10-19T10:00:00.000Z' },
  ],
  projects: [{ id: 'pr_1', name: 'Uno', createdAt: '' }],
  agents: [],
  activeDiagramId: null,
  connection: 'connected',
  nodes: [],
  edges: [],
  origin: 'http://127.0.0.1:3333',
  onConfig: vi.fn(),
  onCloseConfig: vi.fn(),
  onOpen: vi.fn(),
  onCreateDiagram: vi.fn(),
  onImportMermaid: vi.fn(),
  onImportDrawio: vi.fn(),
  onMoveDiagram: vi.fn(),
  onNewProject: vi.fn(),
  onRenameProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onRenameDiagram: vi.fn(),
  onDeleteDiagram: vi.fn(),
  onExport: vi.fn(),
};

const renderShell = (props: Partial<AppShellProps> = {}) =>
  render(
    <ReactFlowProvider>
      <AppShell {...base} {...props} />
    </ReactFlowProvider>,
  );

afterEach(() => localStorage.clear());

describe('barra lateral', () => {
  it('la cabecera deja el lugar del logo en vez del nombre', () => {
    renderShell();
    expect(screen.getByRole('img', { name: 'ChartsIA' })).toBeInTheDocument();
    expect(screen.queryByText('ChartsIA')).toBeNull();
  });

  it('Proyectos muestra cada proyecto con sus diagramas y Recientes los muestra todos', async () => {
    const onOpen = vi.fn();
    renderShell({ onOpen });
    const arbol = screen.getByRole('list', { name: 'Proyectos' });
    expect(within(arbol).getByRole('button', { name: 'Biblioteca' })).toBeInTheDocument();
    expect(within(arbol).queryByText('Tienda')).toBeNull();
    const recientes = screen.getByRole('list', { name: 'Recientes' });
    expect(within(recientes).getByText('Biblioteca')).toBeInTheDocument();
    expect(within(recientes).getByText('Tienda')).toBeInTheDocument();
    await userEvent.click(within(arbol).getByRole('button', { name: 'Biblioteca' }));
    expect(onOpen).toHaveBeenCalledWith('dg_aaaaaaaaaaaa');
  });

  it('el botón Proyectos pliega y despliega la sección', async () => {
    renderShell();
    const proyectos = screen.getByRole('button', { name: 'Proyectos' });
    expect(proyectos).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(proyectos);
    expect(proyectos).toHaveAttribute('aria-expanded', 'false');
  });

  it('sin proyectos explica cómo crear uno', () => {
    renderShell({ projects: [], diagrams: base.diagrams.map(({ projectId: _, ...d }) => d) });
    expect(screen.getByText(/Aún no hay proyectos/)).toBeInTheDocument();
  });

  it('Configuración abre la configuración y el estado de la conexión solo se anuncia', async () => {
    const onConfig = vi.fn();
    renderShell({ onConfig, connection: 'disconnected' });
    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    expect(onConfig).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión con el hub');
  });

  it('el tirador cambia el ancho de la barra con las flechas, lo recuerda y vuelve al inicial con doble clic', () => {
    const { unmount } = renderShell();
    const tirador = screen.getByRole('separator', { name: 'Ancho de la barra de diagramas' });
    expect(tirador).toHaveAttribute('aria-valuenow', '260');
    fireEvent.keyDown(tirador, { key: 'ArrowRight' });
    expect(tirador).toHaveAttribute('aria-valuenow', '276');
    unmount();

    renderShell();
    const otra = screen.getByRole('separator', { name: 'Ancho de la barra de diagramas' });
    expect(otra).toHaveAttribute('aria-valuenow', '276');
    fireEvent.doubleClick(otra);
    expect(otra).toHaveAttribute('aria-valuenow', '260');
    fireEvent.keyDown(otra, { key: 'Home' });
    expect(otra).toHaveAttribute('aria-valuenow', '200');
  });

  it('Vista oculta la barra dejando un riel, lo recuerda y la vuelve a mostrar', async () => {
    const onConfig = vi.fn();
    const { unmount } = renderShell({ onConfig });
    const vista = screen.getByRole('button', { name: 'Vista' });
    expect(vista).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(vista);
    expect(vista).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Recientes' })).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Configuración' }));
    expect(onConfig).toHaveBeenCalled();
    unmount();

    renderShell();
    const otra = screen.getByRole('button', { name: 'Vista' });
    expect(otra).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(otra);
    expect(screen.getByRole('list', { name: 'Recientes' })).toBeInTheDocument();
  });

  it('el ancho siempre queda dentro del rango', () => {
    expect(clampWidth(50, 200, 480)).toBe(200);
    expect(clampWidth(900, 200, 480)).toBe(480);
    expect(clampWidth(300.4, 200, 480)).toBe(300);
  });
});
