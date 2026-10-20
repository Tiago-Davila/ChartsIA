import { type Element } from '@chartsia/core/model';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderFlow } from '../support/render-flow';

const pedido: Element = {
  id: 'Pedido',
  kind: 'class',
  name: 'Pedido',
  abstract: true,
  stereotype: 'entity',
  attributes: [
    { name: 'total', type: 'Decimal', visibility: '-' },
    { name: 'codigo', type: 'String', visibility: '+' },
    { name: 'fecha', type: 'Date', visibility: '#' },
    { name: 'nota', visibility: '~', static: true },
  ],
  operations: [{ name: 'confirmar', parameters: [{ name: 'f', type: 'Date' }], returnType: 'void', visibility: '+' }],
};

describe('UmlClassNode', () => {
  it('dibuja tres compartimentos: cabecera, atributos y operaciones', () => {
    const { container } = renderFlow([pedido]);
    const shape = container.querySelector('[data-testid="shape-Pedido"]')!;
    expect(shape).toBeInTheDocument();
    expect(shape.querySelectorAll('line')).toHaveLength(2);
  });

  it('muestra la visibilidad + - # ~ de cada miembro', () => {
    renderFlow([pedido]);
    for (const text of ['- total: Decimal', '+ codigo: String', '# fecha: Date', '~ nota', '+ confirmar(f: Date): void']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('nombre en cursiva si es abstracta y estereotipo «»', () => {
    renderFlow([pedido]);
    expect(screen.getByText('Pedido')).toHaveAttribute('font-style', 'italic');
    expect(screen.getByText('«entity»')).toBeInTheDocument();
  });

  it('miembros estáticos subrayados', () => {
    renderFlow([pedido]);
    expect(screen.getByText('~ nota')).toHaveAttribute('text-decoration', 'underline');
  });

  it('los nombres con HTML se muestran como texto literal', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { container } = renderFlow([{ ...pedido, id: 'X', name: evil, stereotype: undefined }]);
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('interfaz y enum se dibujan con su estereotipo', () => {
    renderFlow([
      { id: 'I', kind: 'interface', name: 'Pagable', operations: [] },
      { id: 'E', kind: 'enum', name: 'Estado', literals: ['NUEVO', 'PAGADO'] },
    ]);
    expect(screen.getByText('«interface»')).toBeInTheDocument();
    expect(screen.getByText('«enumeration»')).toBeInTheDocument();
    expect(screen.getByText('PAGADO')).toBeInTheDocument();
  });
});
