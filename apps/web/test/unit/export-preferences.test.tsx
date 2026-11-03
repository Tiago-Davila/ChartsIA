import { DEFAULT_EXPORT_PREFERENCES, type ExportPreferences } from '@chartsia/core/export';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigScreen } from '../../src/app/ConfigScreen';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

/** Hub de mentira: GET devuelve las preferencias de exportación guardadas y PUT les suma los cambios. */
function stubHub(initial: ExportPreferences = DEFAULT_EXPORT_PREFERENCES) {
  let saved = initial;
  const puts: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      expect(url).toBe('/api/preferences/export');
      if (init.method === 'PUT') {
        const changes = JSON.parse(init.body as string);
        puts.push(changes);
        saved = { ...saved, ...changes };
      }
      return json(saved);
    }),
  );
  return puts;
}

const renderSection = (onSection = vi.fn()) =>
  render(<ConfigScreen origin="http://127.0.0.1:24278" agents={[]} hub={null} section="exportacion" onSection={onSection} onBack={vi.fn()} />);

describe('sección Exportación de la configuración', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('está en la barra de secciones', async () => {
    stubHub();
    const onSection = vi.fn();
    renderSection(onSection);
    const secciones = screen.getByRole('list', { name: 'Secciones' });
    expect(within(secciones).getByRole('button', { name: 'Exportación' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(secciones).getByRole('button', { name: 'Diagramas' }));
    expect(onSection).toHaveBeenCalledWith('diagramas');
    await screen.findByRole('group', { name: 'Formato por defecto' });
  });

  it('muestra las preferencias guardadas, también un margen que no es de los comunes', async () => {
    stubHub({ format: 'drawio', background: 'transparent', margin: 30, scale: 2, includeTitle: true });
    renderSection();
    expect(within(await screen.findByRole('group', { name: 'Formato por defecto' })).getByRole('radio', { name: 'draw.io' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Fondo' })).getByRole('radio', { name: 'Transparente' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Margen' })).getByRole('radio', { name: '30 px' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Escala' })).getByRole('radio', { name: '2×' })).toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Incluir el título en la imagen' })).getByRole('radio', { name: 'Sí' })).toBeChecked();
  });

  it('cada cambio se guarda en el hub como un cambio parcial', async () => {
    const puts = stubHub();
    renderSection();
    await userEvent.click(within(await screen.findByRole('group', { name: 'Formato por defecto' })).getByRole('radio', { name: 'Excalidraw' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Fondo' })).getByRole('radio', { name: 'Transparente' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Margen' })).getByRole('radio', { name: 'Sin margen' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Escala' })).getByRole('radio', { name: '2×' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Incluir el título en la imagen' })).getByRole('radio', { name: 'Sí' }));
    await waitFor(() => expect(puts).toHaveLength(5));
    expect(puts).toEqual([{ format: 'excalidraw' }, { background: 'transparent' }, { margin: 0 }, { scale: 2 }, { includeTitle: true }]);
    expect(within(screen.getByRole('group', { name: 'Fondo' })).getByRole('radio', { name: 'Transparente' })).toBeChecked();
  });
});
