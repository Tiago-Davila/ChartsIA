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
  activeDiagramId: 'dg_bbbbbbbbbbbb',
  connection: 'connected',
  nodes: [],
  edges: [],
  origin: 'http://127.0.0.1:3333',
  onOpen: vi.fn(),
  onStyleChange: vi.fn(),
  onExport: vi.fn(),
};

const renderShell = (props: Partial<AppShellProps> = {}) =>
  render(
    <ReactFlowProvider>
      <AppShell {...base} {...props} />
    </ReactFlowProvider>,
  );

describe('AppShell', () => {
  it('sin diagrama abierto muestra el estado vacío con los comandos del quickstart', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: 'Conecta tu agente' })).toBeInTheDocument();
    expect(screen.getByText('claude mcp add --transport http chartsia http://127.0.0.1:3333/mcp')).toBeInTheDocument();
  });

  it('lista los diagramas, marca el activo y permite abrir cualquiera', async () => {
    const onOpen = vi.fn();
    renderShell({ onOpen });
    expect(screen.getByText('C4 · Contenedores', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Activo').closest('button')).toHaveTextContent('Tienda');
    await userEvent.click(screen.getByText('Biblioteca'));
    expect(onOpen).toHaveBeenCalledWith('dg_aaaaaaaaaaaa');
  });

  it('con diagrama abierto muestra toolbar, estilo y exportación', async () => {
    const onStyleChange = vi.fn();
    const onExport = vi.fn();
    renderShell({
      onStyleChange,
      onExport,
      diagram: { id: 'dg_aaaaaaaaaaaa', type: 'class', title: 'Biblioteca', style: 'clean', revision: 3, createdAt: '', updatedAt: '', elements: [], relations: [] },
    });
    expect(screen.getByRole('heading', { name: /Biblioteca/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpio' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Boceto' }));
    expect(onStyleChange).toHaveBeenCalledWith('sketch');
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
      diagram: { id: 'dg_bbbbbbbbbbbb', type: 'c4-container', title: 'Tienda', style: 'clean', revision: 1, createdAt: '', updatedAt: '',
        elements: [{ id: 'p', kind: 'person', name: 'Cliente' }, { id: 'x', kind: 'software-system', name: 'Pagos', external: true }], relations: [] },
    });
    const legend = screen.getByRole('complementary', { name: 'Leyenda C4' });
    expect(legend).toHaveTextContent('Persona');
    expect(legend).toHaveTextContent('Externo');
  });
});
