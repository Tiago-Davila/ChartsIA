import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigScreen } from '../../src/app/ConfigScreen';
import { type HubSettings } from '../../src/state/api-client';

const respuesta = (cuerpo: unknown, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status, headers });

const BASE: HubSettings = {
  dataDir: { value: '/datos', source: 'default', running: '/datos' },
  maxElements: { value: 500, source: 'default' },
  network: { value: false, source: 'default', running: false },
  token: { value: null, source: 'default' },
  restartRequired: false,
};

interface Llamada {
  url: string;
  method: string;
  body?: unknown;
}

/** Hub de mentira: guarda los cambios sobre la configuración y responde el respaldo que se le indique. */
function stubHub(inicial: HubSettings = BASE, importar: (llamada: Llamada) => Response = () => respuesta({ imported: 1, replaced: 0, skipped: 0, projectsCreated: 0 })) {
  let guardado = inicial;
  const llamadas: Llamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const llamada: Llamada = { url, method: init.method ?? 'GET', ...(init.body ? { body: JSON.parse(init.body as string) } : {}) };
      llamadas.push(llamada);
      if (url === '/api/hub/config' && llamada.method === 'PUT') {
        const cambios = llamada.body as { dataDir?: string; maxElements?: number; network?: boolean };
        guardado = {
          ...guardado,
          ...(cambios.dataDir ? { dataDir: { ...guardado.dataDir, value: cambios.dataDir } } : {}),
          ...(cambios.maxElements ? { maxElements: { ...guardado.maxElements, value: cambios.maxElements, source: 'file' } } : {}),
          ...(cambios.network === undefined ? {} : { network: { ...guardado.network, value: cambios.network, source: 'file' }, token: { value: cambios.network ? 'token-nuevo-de-prueba' : null, source: 'file' } }),
        };
        guardado.restartRequired = guardado.dataDir.value !== guardado.dataDir.running || guardado.network.value !== guardado.network.running;
        return respuesta(guardado);
      }
      if (url === '/api/hub/token') {
        guardado = { ...guardado, token: { value: 'token-regenerado', source: 'file' }, restartRequired: true };
        return respuesta(guardado);
      }
      if (url === '/api/backup' && llamada.method === 'GET') {
        return respuesta('{"format":"chartsia-backup"}', 200, { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="chartsia-respaldo-2026-11-03.json"' });
      }
      if (url === '/api/backup/import') return importar(llamada);
      return respuesta(guardado);
    }),
  );
  return llamadas;
}

const renderSection = (onSection = vi.fn()) =>
  render(<ConfigScreen origin="http://127.0.0.1:24278" agents={[]} hub={null} section="hub" onSection={onSection} onBack={vi.fn()} />);

describe('sección Hub y datos de la configuración', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('está en la barra de secciones', async () => {
    stubHub();
    const onSection = vi.fn();
    renderSection(onSection);
    const secciones = screen.getByRole('list', { name: 'Secciones' });
    expect(within(secciones).getByRole('button', { name: 'Hub y datos' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(secciones).getByRole('button', { name: 'General' }));
    expect(onSection).toHaveBeenCalledWith('general');
    await screen.findByLabelText('Carpeta de datos');
  });

  it('muestra los valores y bloquea los que vienen de una variable de entorno', async () => {
    stubHub({ ...BASE, dataDir: { value: '/otra', source: 'env', running: '/otra' }, maxElements: { value: 7, source: 'file' } });
    renderSection();
    const carpeta = await screen.findByLabelText('Carpeta de datos');
    expect(carpeta).toHaveValue('/otra');
    expect(carpeta).toBeDisabled();
    expect(screen.getByText(/Definido por la variable CHARTSIA_DATA_DIR/)).toBeInTheDocument();
    expect(screen.getByLabelText('Máximo de elementos por diagrama')).toHaveValue(7);
    expect(screen.getByLabelText('Máximo de elementos por diagrama')).toBeEnabled();
  });

  it('guarda el límite y el cambio de carpeta avisa que requiere reiniciar', async () => {
    const llamadas = stubHub();
    renderSection();
    const max = await screen.findByLabelText('Máximo de elementos por diagrama');
    await userEvent.clear(max);
    await userEvent.type(max, '40');
    await userEvent.click(within(max.closest('form')!).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(llamadas.find((l) => l.method === 'PUT')?.body).toEqual({ maxElements: 40 }));
    expect(screen.queryByRole('status')).toBeNull();

    const carpeta = screen.getByLabelText('Carpeta de datos');
    await userEvent.clear(carpeta);
    await userEvent.type(carpeta, '/nueva');
    await userEvent.click(within(carpeta.closest('form')!).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('aplica al reiniciarse');
    expect(screen.getByText(/El hub usa \/datos hasta reiniciarse/)).toBeInTheDocument();
  });

  it('habilitar la red pide confirmación y después muestra el token', async () => {
    const llamadas = stubHub();
    renderSection();
    await userEvent.click(await screen.findByRole('radio', { name: 'Desde la red' }));
    const dialogo = screen.getByRole('dialog', { name: 'Habilitar el acceso desde la red' });
    expect(llamadas.some((l) => l.method === 'PUT')).toBe(false);
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(llamadas.some((l) => l.method === 'PUT')).toBe(false);

    await userEvent.click(screen.getByRole('radio', { name: 'Desde la red' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Habilitar' }));
    expect(await screen.findByText('token-nuevo-de-prueba')).toBeInTheDocument();
    expect(llamadas.find((l) => l.method === 'PUT')?.body).toEqual({ network: true });
    expect(screen.getByText(/aplica al reiniciarse/)).toBeInTheDocument();
  });

  it('regenerar el token pide confirmación y muestra el nuevo', async () => {
    const llamadas = stubHub({ ...BASE, network: { value: true, source: 'file', running: true }, token: { value: 'token-viejo', source: 'file' } });
    renderSection();
    expect(await screen.findByText('token-viejo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Regenerar token' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Regenerar' }));
    expect(await screen.findByText('token-regenerado')).toBeInTheDocument();
    expect(llamadas.some((l) => l.url === '/api/hub/token' && l.method === 'POST')).toBe(true);
  });

  it('exporta el respaldo como descarga', async () => {
    stubHub();
    const crear = vi.fn(() => 'blob:respaldo');
    vi.stubGlobal('URL', { ...URL, createObjectURL: crear, revokeObjectURL: vi.fn() });
    const descargas: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargas.push(this.download);
    });
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar respaldo' }));
    await waitFor(() => expect(descargas).toEqual(['chartsia-respaldo-2026-11-03.json']));
  });

  it('importa un respaldo y cuenta lo que entró', async () => {
    const llamadas = stubHub();
    renderSection();
    const archivo = new File(['{"format":"chartsia-backup","version":1}'], 'respaldo.json', { type: 'application/json' });
    await userEvent.upload(await screen.findByLabelText('Archivo de respaldo'), archivo);
    expect(await screen.findByText(/Importación lista: 1 diagrama\(s\) nuevo\(s\), 0 reemplazado\(s\)/)).toBeInTheDocument();
    expect(llamadas.find((l) => l.url === '/api/backup/import')?.body).toEqual({ backup: { format: 'chartsia-backup', version: 1 } });
  });

  it('con ids repetidos pregunta y reenvía con la elección', async () => {
    let intentos = 0;
    const llamadas = stubHub(BASE, () => {
      intentos++;
      return intentos === 1
        ? respuesta({ errors: [{ code: 'IMPORT_CONFLICT', path: '/backup/diagrams/0/diagram/id', message: 'El diagrama "dg_aaaaaaaaaaaa" ya existe como "Pedidos".', hint: '' }] }, 409)
        : respuesta({ imported: 0, replaced: 1, skipped: 0, projectsCreated: 0 });
    });
    renderSection();
    await userEvent.upload(await screen.findByLabelText('Archivo de respaldo'), new File(['{"a":1}'], 'respaldo.json'));
    const dialogo = await screen.findByRole('dialog', { name: 'Diagramas que ya existen' });
    expect(within(dialogo).getByText(/dg_aaaaaaaaaaaa/)).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Reemplazar' }));
    expect(await screen.findByText(/1 reemplazado\(s\)/)).toBeInTheDocument();
    const envios = llamadas.filter((l) => l.url === '/api/backup/import').map((l) => l.body);
    expect(envios).toEqual([{ backup: { a: 1 } }, { backup: { a: 1 }, onConflict: 'replace' }]);
  });

  it('un archivo que no es JSON se rechaza sin llamar al hub', async () => {
    const llamadas = stubHub();
    renderSection();
    await userEvent.upload(await screen.findByLabelText('Archivo de respaldo'), new File(['esto no es json'], 'respaldo.json'));
    expect(await screen.findByRole('alert')).toHaveTextContent('no es un JSON válido');
    expect(llamadas.some((l) => l.url === '/api/backup/import')).toBe(false);
  });
});
