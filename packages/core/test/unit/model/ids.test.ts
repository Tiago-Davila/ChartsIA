import { describe, expect, it } from 'vitest';
import { DIAGRAM_ID_PATTERN, isDiagramId, newDiagramId } from '../../../src/model/index.js';

describe('newDiagramId', () => {
  it('genera "dg_" + 12 caracteres base32', () => {
    for (let i = 0; i < 100; i++) expect(newDiagramId()).toMatch(DIAGRAM_ID_PATTERN);
  });

  it('es determinista con una fuente de bytes fija', () => {
    const id = newDiagramId((n) => new Uint8Array(n).map((_, i) => i));
    expect(id).toBe('dg_abcdefghijkl');
  });

  it('no repite en muestras grandes', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newDiagramId()));
    expect(ids.size).toBe(2000);
  });

  it('isDiagramId rechaza rutas y valores ajenos', () => {
    expect(isDiagramId('dg_abcdefghijkl')).toBe(true);
    expect(isDiagramId('../etc/passwd')).toBe(false);
    expect(isDiagramId('dg_ABCDEFGHIJKL')).toBe(false);
  });
});
