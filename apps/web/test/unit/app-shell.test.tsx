import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
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
  agents: [],
  activeDiagramId: 'dg_bbbbbbbbbbbb',
  connection: 'connected',
  nodes: [],
  edges: [],
  origin: 'http://127.0.0.1:3333',
  onConfig: vi.fn(),
  onCloseConfig: vi.fn(),
  onOpen: vi.fn(),
  onCreateDiagram: vi.fn(),
  onImportMermaid: vi.fn(),
  onMoveDiagram: vi.fn(),
  onNewProject: vi.fn(),
  onRenameProject: vi.fn(),
  onDeleteProject: vi.fn(),
  onRenameDiagram: vi.fn(),
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

  it('"Nuevo proyecto…" abre una ventana y solo llama al hub con un nombre no vacío', async () => {
    const onNewProject = vi.fn();
    renderShell({ onNewProject });
    const abrir = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Opciones de Biblioteca' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Nuevo proyecto…' }));
      return screen.getByRole('dialog', { name: 'Nuevo proyecto' });
    };
    await userEvent.click(within(await abrir()).getByRole('button', { name: 'Cancelar' }));
    await userEvent.type(within(await abrir()).getByLabelText('Nombre'), '   {Enter}');
    await userEvent.keyboard('{Escape}');
    expect(onNewProject).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.type(within(await abrir()).getByLabelText('Nombre'), ' Nuevo {Enter}');
    expect(onNewProject).toHaveBeenCalledWith('dg_aaaaaaaaaaaa', 'Nuevo');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Renombrar…" abre la ventana con el título actual y solo llama al hub si cambia', async () => {
    const onRenameDiagram = vi.fn();
    renderShell({ onRenameDiagram });
    const abrir = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Opciones de Biblioteca' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Renombrar…' }));
      return within(screen.getByRole('dialog', { name: 'Renombrar diagrama' })).getByLabelText('Nombre');
    };
    expect(await abrir()).toHaveValue('Biblioteca');
    await userEvent.keyboard('{Enter}');
    expect(onRenameDiagram).not.toHaveBeenCalled();
    const campo = await abrir();
    await userEvent.clear(campo);
    await userEvent.type(campo, ' Otro {Enter}');
    expect(onRenameDiagram).toHaveBeenCalledWith('dg_aaaaaaaaaaaa', 'Otro');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Renombrar…" del menú de un proyecto abre la ventana con su nombre y solo llama al hub si cambia', async () => {
    const onRenameProject = vi.fn();
    const projects = [{ id: 'pr_aaaaaaaaaaaa', name: 'Tienda', createdAt: '2026-10-01T10:00:00.000Z' }];
    renderShell({ onRenameProject, projects, diagrams: [{ ...base.diagrams[0]!, projectId: 'pr_aaaaaaaaaaaa' }] });
    const abrir = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Opciones del proyecto Tienda' }));
      await userEvent.click(screen.getByRole('menuitem', { name: 'Renombrar…' }));
      return within(screen.getByRole('dialog', { name: 'Renombrar proyecto' })).getByLabelText('Nombre');
    };
    expect(await abrir()).toHaveValue('Tienda');
    await userEvent.keyboard('{Enter}');
    expect(onRenameProject).not.toHaveBeenCalled();
    const campo = await abrir();
    await userEvent.clear(campo);
    await userEvent.type(campo, ' Comercio {Enter}');
    expect(onRenameProject).toHaveBeenCalledWith('pr_aaaaaaaaaaaa', 'Comercio');
    expect(screen.queryByRole('dialog')).toBeNull();
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

describe('AppShell: título editable', () => {
  const diagram = { id: 'dg_bbbbbbbbbbbb', type: 'class', title: 'Tienda', revision: 1, elements: [], relations: [] } as unknown as AppShellProps['diagram'];
  const abrirEditor = async (props: Partial<AppShellProps> = {}) => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderShell({ diagram, onRename, ...props });
    await user.dblClick(screen.getByRole('heading', { name: /Tienda/ }));
    return { user, onRename, input: screen.queryByRole('textbox', { name: 'Título del diagrama' }) };
  };

  it('Enter guarda el título nuevo', async () => {
    const { user, onRename, input } = await abrirEditor();
    await user.clear(input!);
    await user.type(input!, 'Mercado{Enter}');
    expect(onRename).toHaveBeenCalledWith('Mercado');
  });

  it('Escape cancela sin llamar al hub', async () => {
    const { user, onRename, input } = await abrirEditor();
    await user.type(input!, 'X{Escape}');
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Tienda/ })).toBeInTheDocument();
  });

  it('un título vacío o igual al actual no llama al hub', async () => {
    const { user, onRename, input } = await abrirEditor();
    await user.clear(input!);
    await user.keyboard('{Enter}');
    await user.dblClick(screen.getByRole('heading', { name: /Tienda/ }));
    await user.keyboard('{Enter}');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('en solo lectura no se edita', async () => {
    const { input } = await abrirEditor({ readOnly: true });
    expect(input).toBeNull();
  });

  it('el lápiz y el marcador son herramientas excluyentes con su propio color', async () => {
    renderShell({ diagram: { id: 'dg_aaaaaaaaaaaa', type: 'class', title: 'Biblioteca', revision: 3, createdAt: '', updatedAt: '', elements: [], relations: [] } });
    const pen = screen.getByRole('button', { name: 'Lápiz' });
    const marker = screen.getByRole('button', { name: 'Marcador' });
    expect(pen).toHaveAttribute('aria-pressed', 'false');
    expect(marker).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Color del marcador')).toBeNull();

    await userEvent.click(marker);
    expect(marker).toHaveAttribute('aria-pressed', 'true');
    expect(pen).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Color del marcador')).toHaveValue('#facc15');

    await userEvent.click(pen);
    expect(marker).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Color del lápiz')).toHaveValue('#1f2933');

    await userEvent.click(pen);
    expect(screen.queryByLabelText('Color del lápiz')).toBeNull();
  });
});

describe('AppShell: barra de figuras', () => {
  const diagram = (type: 'class' | 'nosql') => ({ id: 'dg_aaaaaaaaaaaa', type, title: 'Prueba', revision: 1, createdAt: '', updatedAt: '', elements: [], relations: [] });
  const figura = (clave: string) => document.querySelector(`[data-figure="${clave}"]`)!;

  it('muestra todas las figuras, sin importar el tipo de diagrama abierto', () => {
    renderShell({ diagram: diagram('class'), onAddFigure: vi.fn() });
    const barra = screen.getByRole('complementary', { name: 'Figuras' });
    expect(barra).toHaveTextContent('Clase');
    expect(barra).toHaveTextContent('Círculo');
    expect(barra).toHaveTextContent('Persona');
    expect(barra).toHaveTextContent('Entidad');
    expect(barra).toHaveTextContent('Colección');
  });

  it('no aparece en solo lectura, en la configuración ni sin diagrama', () => {
    const { unmount } = renderShell({ diagram: diagram('class'), onAddFigure: vi.fn(), readOnly: true });
    expect(screen.queryByRole('complementary', { name: 'Figuras' })).toBeNull();
    unmount();
    const configuracion = renderShell({ diagram: diagram('class'), onAddFigure: vi.fn(), configOpen: true });
    expect(screen.queryByRole('complementary', { name: 'Figuras' })).toBeNull();
    configuracion.unmount();
    renderShell({ onAddFigure: vi.fn() });
    expect(screen.queryByRole('complementary', { name: 'Figuras' })).toBeNull();
  });

  it('soltar una figura sobre el lienzo la crea en la posición del puntero', () => {
    const onAddFigure = vi.fn();
    renderShell({ diagram: diagram('class'), onAddFigure });
    const data = new Map<string, string>();
    const dataTransfer = { types: [] as string[], setData: (type: string, value: string) => { data.set(type, value); dataTransfer.types = [...data.keys()]; }, getData: (type: string) => data.get(type) ?? '', files: [], effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(figura('class'), { dataTransfer });
    const lienzo = document.querySelector('.app-shell__canvas')!;
    fireEvent.dragOver(lienzo, { dataTransfer });
    // jsdom no implementa DragEvent: las coordenadas se agregan al evento.
    const drop = createEvent.drop(lienzo, { dataTransfer });
    Object.defineProperties(drop, { clientX: { value: 240 }, clientY: { value: 130 } });
    fireEvent(lienzo, drop);
    expect(onAddFigure).toHaveBeenCalledWith('class', { x: 240, y: 130 });
  });

  it('doble clic en una figura la agrega en el centro de la vista', () => {
    const onAddFigureAtCenter = vi.fn();
    renderShell({ diagram: diagram('class'), onAddFigure: vi.fn(), onAddFigureAtCenter });
    fireEvent.doubleClick(figura('figure-circle'));
    // jsdom no calcula el diseño: el lienzo mide 0 y su centro es el origen.
    expect(onAddFigureAtCenter).toHaveBeenCalledWith('figure-circle', { x: 0, y: 0 });
  });
});
