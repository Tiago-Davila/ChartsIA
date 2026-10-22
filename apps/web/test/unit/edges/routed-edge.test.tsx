import { type Element, type Relation } from '@chartsia/core/model';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderFlow } from '../support/render-flow';

const box = (id: string, x: number, kind: 'class' | 'container' = 'class'): Element =>
  kind === 'class'
    ? { id, kind, name: id, attributes: [], operations: [], layout: { x, y: 0, width: 140, height: 60, pinned: false } }
    : { id, kind, name: id, layout: { x, y: 0, width: 200, height: 110, pinned: false } };

const route = [{ x: 140, y: 30 }, { x: 200, y: 30 }, { x: 200, y: 80 }, { x: 300, y: 80 }];

function edgeGroup(container: HTMLElement, id: string) {
  return container.querySelector(`[data-testid="edge-${id}"]`)!;
}

describe('RoutedEdge', () => {
  it('dibuja la polilínea de route', () => {
    const rel: Relation = { id: 'r', kind: 'association', source: 'A', target: 'B', route };
    const { container } = renderFlow([box('A', 0), box('B', 300)], [rel]);
    const path = edgeGroup(container, 'r').querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M 140 30 L 200 30 L 200 80 L 300 80');
  });

  it.each([
    ['inheritance', 1, '#ffffff'],
    ['composition', 1, '#3e4c59'],
    ['aggregation', 1, '#ffffff'],
  ] as const)('marcador correcto para %s', (kind, markers, fill) => {
    const { container } = renderFlow([box('A', 0), box('B', 300)], [{ id: 'r', kind, source: 'A', target: 'B', route }]);
    const closed = [...edgeGroup(container, 'r').querySelectorAll('path')].filter((p) => p.getAttribute('d')?.endsWith('Z'));
    expect(closed).toHaveLength(markers);
    expect(closed[0]!.getAttribute('fill')).toBe(fill);
  });

  it('el grosor del estilo engrosa la línea y su marcador, y sin estilo es 1.5', () => {
    const grueso: Relation = { id: 'r', kind: 'composition', source: 'A', target: 'B', route, style: { lineWidth: 'thick' } };
    const { container } = renderFlow([box('A', 0), box('B', 300)], [grueso]);
    const widths = [...edgeGroup(container, 'r').querySelectorAll('path')].map((p) => p.getAttribute('stroke-width')).filter((w) => w !== '14');
    expect(widths.length).toBeGreaterThan(1);
    expect(new Set(widths)).toEqual(new Set(['3']));
    const normal = renderFlow([box('A', 0), box('B', 300)], [{ id: 'r', kind: 'association', source: 'A', target: 'B', route }]);
    expect(edgeGroup(normal.container, 'r').querySelector('path')!.getAttribute('stroke-width')).toBe('1.5');
  });

  it('dependencia y realización van discontinuas', () => {
    const { container } = renderFlow([box('A', 0), box('B', 300)], [{ id: 'r', kind: 'dependency', source: 'A', target: 'B', route }]);
    expect(edgeGroup(container, 'r').querySelector('path')!.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('c4-rel muestra "descripción" y "[tecnología]"', () => {
    renderFlow([box('A', 0, 'container'), box('B', 300, 'container')], [
      { id: 'r', kind: 'c4-rel', source: 'A', target: 'B', label: 'Lee y escribe', technology: 'SQL', route },
    ]);
    expect(screen.getByText('Lee y escribe')).toBeInTheDocument();
    expect(screen.getByText('[SQL]')).toBeInTheDocument();
  });

  it('muestra las multiplicidades', () => {
    renderFlow([box('A', 0), box('B', 300)], [{ id: 'r', kind: 'association', source: 'A', target: 'B', sourceMultiplicity: '1', targetMultiplicity: '0..*', route }]);
    expect(screen.getByText('0..*')).toBeInTheDocument();
  });
});
