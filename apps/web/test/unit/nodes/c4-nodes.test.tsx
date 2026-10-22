import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderFlow } from '../support/render-flow';

describe('nodos C4', () => {
  it('etiqueta de tipo "[Container: tecnología]"', () => {
    renderFlow([{ id: 'api', kind: 'container', name: 'API', technology: 'Nest.js' }]);
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('[Container: Nest.js]')).toBeInTheDocument();
  });

  it('variante database se dibuja como cilindro (elipse en la tapa)', () => {
    const { container } = renderFlow([{ id: 'db', kind: 'container', name: 'BD', variant: 'database' }]);
    const shape = container.querySelector('[data-testid="shape-db"]')!;
    expect(shape.querySelector('ellipse')).not.toBeNull();
    expect(shape.querySelector('path')).not.toBeNull();
  });

  it('los externos se pintan en gris', () => {
    const { container } = renderFlow([{ id: 'pagos', kind: 'software-system', name: 'Pagos', external: true }]);
    const body = container.querySelector('[data-testid="shape-pagos"] rect')!;
    expect(body.getAttribute('fill')?.toLowerCase()).toBe('#999999');
    expect(screen.getByText('[Software System - External]')).toBeInTheDocument();
  });

  it('persona con cabeza y cuerpo; componente con su tecnología', () => {
    const { container } = renderFlow([
      { id: 'p', kind: 'person', name: 'Cliente', description: 'Compra productos' },
      { id: 'c', kind: 'component', name: 'Ctrl', technology: 'Nest' },
    ]);
    expect(container.querySelector('[data-testid="shape-p"] ellipse')).not.toBeNull();
    expect(screen.getByText('Compra productos')).toBeInTheDocument();
    expect(screen.getByText('[Component: Nest]')).toBeInTheDocument();
  });

  it('el estilo del elemento cambia colores, fuente y tamaño del lienzo', () => {
    const style = { fillColor: '#112233', borderColor: '#445566', fontColor: '#778899', fontFamily: 'monospace', fontSize: 20 } as const;
    const { container } = renderFlow([{ id: 's', kind: 'software-system', name: 'Tienda', style }]);
    const shape = container.querySelector('[data-testid="shape-s"]')!;
    expect(shape.querySelector('rect')?.getAttribute('fill')).toBe('#112233');
    expect(shape.querySelector('rect')?.getAttribute('stroke')).toBe('#445566');
    const name = screen.getByText('Tienda');
    expect(name.getAttribute('fill')).toBe('#778899');
    expect(name.getAttribute('font-family')).toContain('monospace');
    expect(name.getAttribute('font-size')).toBe('21');
  });

  it('límite discontinuo con "[tipo]"', () => {
    const { container } = renderFlow([{ id: 'b', kind: 'boundary', name: 'Tienda', boundaryType: 'system', layout: { x: 0, y: 0, width: 400, height: 300, pinned: false } }]);
    expect(container.querySelector('[data-testid="shape-b"] rect')?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(screen.getByText('[Software System]')).toBeInTheDocument();
  });
});
