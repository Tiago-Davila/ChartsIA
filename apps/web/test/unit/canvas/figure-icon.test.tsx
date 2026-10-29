import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FigureIcon } from '../../../src/canvas/FigureIcon';
import { PALETTE_ITEMS } from '../../../src/canvas/figure-palette';

describe('ícono de cada figura de la barra', () => {
  it.each(PALETTE_ITEMS.map((item) => [item.label, item] as const))('%s se dibuja con su geometría, sin textos', (_label, item) => {
    const { container } = render(<FigureIcon item={item} />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelectorAll('rect, ellipse, path, line').length).toBeGreaterThan(0);
    expect(svg.querySelector('text')).toBeNull();
    const [, , ancho, alto] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(ancho).toBeGreaterThan(0);
    expect(alto).toBeGreaterThan(0);
  });
});
