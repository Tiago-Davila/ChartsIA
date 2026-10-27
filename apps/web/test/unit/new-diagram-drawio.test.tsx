import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewDiagram } from '../../src/app/NewDiagram';
import { esDrawio, usePasteDrawio } from '../../src/canvas/use-paste-drawio';

const proyectos = [{ id: 'pr_1', name: 'Tienda', createdAt: '2026-01-01' }];
const XML = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

const abrir = async (onImportDrawio = vi.fn().mockResolvedValue([]), projects = proyectos) => {
  render(<NewDiagram projects={projects} onCreate={vi.fn()} onImportMermaid={vi.fn()} onImportDrawio={onImportDrawio} />);
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Importar draw.io' }));
  return onImportDrawio;
};

describe('NewDiagram: importar draw.io', () => {
  it('abre el formulario en una ventana y no deja importar sin contenido', async () => {
    await abrir();
    expect(screen.getByRole('dialog', { name: 'Importar draw.io' })).toContainElement(screen.getByRole('form', { name: 'Importar draw.io' }));
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
  });

  it('importa el XML pegado con título y proyecto opcionales', async () => {
    const onImportDrawio = await abrir();
    await userEvent.click(screen.getByLabelText('XML de draw.io'));
    await userEvent.paste(XML);
    await userEvent.type(screen.getByLabelText('Título (opcional)'), ' Desde draw.io ');
    await userEvent.selectOptions(screen.getByLabelText('Proyecto'), 'pr_1');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onImportDrawio).toHaveBeenCalledWith(XML, 'Desde draw.io', 'pr_1');
    expect(screen.queryByRole('form', { name: 'Importar draw.io' })).toBeNull();
  });

  it('lee un archivo .drawio, lo muestra en el cuadro de texto y lo importa', async () => {
    const onImportDrawio = await abrir();
    await userEvent.upload(screen.getByLabelText('Archivo .drawio o .xml'), new File([XML], 'tienda.drawio', { type: 'text/xml' }));
    expect(await screen.findByDisplayValue(XML)).toBeInTheDocument();
    expect(screen.getByText('tienda.drawio')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onImportDrawio).toHaveBeenCalledWith(XML, undefined, undefined);
  });

  it('rechaza un archivo sobre el máximo sin leerlo', async () => {
    await abrir();
    const grande = new File(['x'], 'grande.drawio');
    Object.defineProperty(grande, 'size', { value: 5 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText('Archivo .drawio o .xml'), grande);
    expect(await screen.findByRole('alert')).toHaveTextContent('máximo de 4 MiB');
    expect(screen.getByLabelText('XML de draw.io')).toHaveValue('');
  });

  it('conserva el texto si falla la importación y muestra los avisos si termina con aproximaciones', async () => {
    const onImportDrawio = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(['La forma "cylinder3" no tiene equivalente y se omitió.']);
    await abrir(onImportDrawio);
    await userEvent.click(screen.getByLabelText('XML de draw.io'));
    await userEvent.paste(XML);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByLabelText('XML de draw.io')).toHaveValue(XML);
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Diagrama importado con aproximaciones');
    expect(screen.getByRole('list', { name: 'Avisos de importación' })).toHaveTextContent('cylinder3');
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
  });
});

describe('pegar lo copiado en draw.io', () => {
  it('reconoce un mxGraphModel o un mxfile, también codificados como URL', () => {
    expect(esDrawio(XML)).toBe(true);
    expect(esDrawio('  <mxfile host="x"></mxfile>')).toBe(true);
    expect(esDrawio(encodeURIComponent(XML))).toBe(true);
    expect(esDrawio('classDiagram\nclass A')).toBe(false);
    expect(esDrawio('<svg></svg>')).toBe(false);
  });

  function Pegable({ onImport, enabled = true }: { onImport(source: string): void; enabled?: boolean }) {
    usePasteDrawio(onImport, enabled);
    return <input aria-label="campo" />;
  }
  /** Dispara un pegado con el texto dado sobre el elemento. */
  function pegar(target: Element, text: string) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    target.dispatchEvent(event);
    return event;
  }

  it('importa el XML pegado fuera de un campo de texto y cancela el pegado normal', () => {
    const onImport = vi.fn();
    render(<Pegable onImport={onImport} />);
    const event = pegar(document.body, XML);
    expect(onImport).toHaveBeenCalledWith(XML);
    expect(event.defaultPrevented).toBe(true);
  });

  it('no actúa dentro de un campo de texto, con otro contenido ni deshabilitado', () => {
    const onImport = vi.fn();
    const { rerender } = render(<Pegable onImport={onImport} />);
    pegar(screen.getByLabelText('campo'), XML);
    pegar(document.body, 'texto cualquiera');
    rerender(<Pegable onImport={onImport} enabled={false} />);
    pegar(document.body, XML);
    expect(onImport).not.toHaveBeenCalled();
  });
});
