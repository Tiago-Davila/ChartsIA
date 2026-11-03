import { DEFAULT_PREFERENCES, type Diagram, type Preferences } from '@chartsia/core/model';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigScreen } from '../../src/app/ConfigScreen';
import { toReactFlow } from '../../src/canvas/to-react-flow';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

/** Hub de mentira: GET devuelve las preferencias guardadas y PUT les suma los cambios. */
function stubHub(initial: Preferences = DEFAULT_PREFERENCES) {
  let saved = initial;
  const puts: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') {
        const changes = JSON.parse(init.body as string);
        puts.push(changes);
        saved = { ...saved, ...changes, uml: { ...saved.uml, ...changes.uml } };
      }
      return json(saved);
    }),
  );
  return puts;
}

const renderSection = (onSection = vi.fn()) =>
  render(<ConfigScreen origin="http://127.0.0.1:24278" agents={[]} hub={null} section="diagramas" onSection={onSection} onBack={vi.fn()} />);

describe('sección Diagramas de la configuración', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('está en la barra de secciones', async () => {
    stubHub();
    const onSection = vi.fn();
    renderSection(onSection);
    const secciones = screen.getByRole('list', { name: 'Secciones' });
    expect(within(secciones).getByRole('button', { name: 'Diagramas' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(secciones).getByRole('button', { name: 'General' }));
    expect(onSection).toHaveBeenCalledWith('general');
    await screen.findByRole('group', { name: 'Dirección' });
  });

  it('muestra las preferencias guardadas', async () => {
    stubHub({ ...DEFAULT_PREFERENCES, direction: 'right', uml: { ...DEFAULT_PREFERENCES.uml, methods: false } });
    renderSection();
    const direccion = await screen.findByRole('group', { name: 'Dirección' });
    expect(within(direccion).getByRole('radio', { name: 'De izquierda a derecha' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Métodos' })).getByRole('radio', { name: 'Ocultar' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Tipos' })).getByRole('radio', { name: 'Mostrar' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Leyenda' })).getByRole('radio', { name: 'Mostrar' })).toBeChecked();
  });

  it('cada cambio se guarda en el hub como un cambio parcial', async () => {
    const puts = stubHub();
    renderSection();
    await userEvent.click(within(await screen.findByRole('group', { name: 'Dirección' })).getByRole('radio', { name: 'De izquierda a derecha' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Espacio entre capas' })).getByRole('radio', { name: 'Amplio' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Multiplicidades' })).getByRole('radio', { name: 'Ocultar' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Leyenda' })).getByRole('radio', { name: 'Ocultar' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Fuente' })).getByRole('radio', { name: 'Manuscrita' }));
    await waitFor(() => expect(puts).toHaveLength(5));
    expect(puts).toEqual([
      { direction: 'right' },
      { layerSpacing: 'wide' },
      { uml: { multiplicities: false } },
      { c4Legend: false },
      { fontFamily: 'handwritten' },
    ]);
    expect(within(screen.getByRole('group', { name: 'Dirección' })).getByRole('radio', { name: 'De izquierda a derecha' })).toBeChecked();
  });

  it('quitar los colores de un tipo manda null', async () => {
    const puts = stubHub({ ...DEFAULT_PREFERENCES, palette: { class: { fillColor: '#fde68a' } } });
    renderSection();
    const clase = (await screen.findByText('Clase')).closest('li')!;
    const interfaz = screen.getByText('Interfaz').closest('li')!;
    expect(within(interfaz).getByRole('button', { name: 'Quitar' })).toBeDisabled();
    expect(within(clase).getByLabelText('Relleno de Clase')).toHaveValue('#fde68a');
    await userEvent.click(within(clase).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(puts).toEqual([{ palette: { class: null } }]));
  });
});

describe('toReactFlow con preferencias', () => {
  const diagram = (preferences?: Preferences): Diagram => ({
    id: 'dg_aaaaaaaaaaaa',
    type: 'class',
    title: 'X',
    revision: 1,
    createdAt: '',
    updatedAt: '',
    ...(preferences ? { preferences } : {}),
    elements: [
      { id: 'A', kind: 'class', name: 'A', attributes: [{ name: 'x', type: 'int', visibility: '+' }], operations: [{ name: 'run', parameters: [], visibility: '+' }] },
      { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [] },
    ],
    relations: [{ id: 'r1', kind: 'association', source: 'A', target: 'B' }],
  });

  it('pasa el detalle UML a los nodos y las multiplicidades a las aristas', () => {
    const uml = { ...DEFAULT_PREFERENCES.uml, methods: false, multiplicities: false };
    const { nodes, edges } = toReactFlow(diagram({ ...DEFAULT_PREFERENCES, uml }));
    expect(nodes[0]!.data.uml).toEqual(uml);
    expect(edges[0]!.data!.showMultiplicities).toBe(false);
  });

  it('un diagrama sin preferencias se mide con todo el detalle', () => {
    const sin = toReactFlow(diagram());
    expect(sin.nodes[0]!.data.uml).toBeUndefined();
    const sinMetodos = toReactFlow(diagram({ ...DEFAULT_PREFERENCES, uml: { ...DEFAULT_PREFERENCES.uml, methods: false } }));
    expect(sinMetodos.nodes.find((n) => n.id === 'A')!.height).toBeLessThan(sin.nodes.find((n) => n.id === 'A')!.height!);
  });
});
