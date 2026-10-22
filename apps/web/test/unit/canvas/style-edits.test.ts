import { describe, expect, it } from 'vitest';
import { commonValue, commonWidth, fieldUpdates, parseFontSize, resetUpdates, type StyleTarget, widthUpdates, withField } from '../../../src/canvas/style-edits';

const clase = (id: string, style?: StyleTarget['style']): StyleTarget => ({ id, relation: false, style });

describe('withField', () => {
  it('conserva el resto del estilo al cambiar un campo', () => {
    expect(withField({ borderColor: '#000000', fontSize: 12 }, 'fillColor', '#ffffff')).toEqual({ borderColor: '#000000', fontSize: 12, fillColor: '#ffffff' });
  });

  it('quitar el último campo deja el estilo en null', () => {
    expect(withField({ fillColor: '#ffffff' }, 'fillColor', undefined)).toBeNull();
    expect(withField(undefined, 'fontSize', undefined)).toBeNull();
  });
});

describe('commonValue', () => {
  it('devuelve el valor compartido o undefined si difieren', () => {
    expect(commonValue([clase('A', { fillColor: '#ffffff' }), clase('B', { fillColor: '#ffffff' })], 'fillColor')).toBe('#ffffff');
    expect(commonValue([clase('A', { fillColor: '#ffffff' }), clase('B', { fillColor: '#000000' })], 'fillColor')).toBeUndefined();
    expect(commonValue([clase('A', { fillColor: '#ffffff' }), clase('B')], 'fillColor')).toBeUndefined();
  });
});

describe('fieldUpdates y resetUpdates', () => {
  it('aplica el campo a cada objetivo conservando su propio estilo', () => {
    const targets: StyleTarget[] = [clase('A', { fontSize: 20 }), { id: 'r1', relation: true }];
    expect(fieldUpdates(targets, 'borderColor', '#dc2626')).toEqual([
      { id: 'A', relation: false, style: { fontSize: 20, borderColor: '#dc2626' } },
      { id: 'r1', relation: true, style: { borderColor: '#dc2626' } },
    ]);
  });

  it('restablecer borra solo el estilo de quienes lo tienen', () => {
    expect(resetUpdates([clase('A', { fontSize: 20 }), clase('B')])).toEqual([{ id: 'A', relation: false, style: null }]);
  });
});

describe('commonWidth y widthUpdates', () => {
  it('sin estilo el grosor es medio y un trazo se compara con las opciones del lápiz', () => {
    expect(commonWidth([clase('A')], [])).toBe('medium');
    expect(commonWidth([], [{ id: 'T', strokeWidth: 5 }])).toBe('thick');
    expect(commonWidth([clase('A')], [{ id: 'T', strokeWidth: 2.5 }])).toBe('medium');
  });

  it('devuelve undefined si difieren o si el trazo tiene un grosor fuera de las opciones', () => {
    expect(commonWidth([clase('A', { lineWidth: 'thin' }), clase('B')], [])).toBeUndefined();
    expect(commonWidth([], [{ id: 'T', strokeWidth: 3 }])).toBeUndefined();
  });

  it('pone lineWidth en los objetivos y strokeWidth en los trazos', () => {
    expect(widthUpdates([clase('A', { fontSize: 20 }), { id: 'r1', relation: true }], [{ id: 'T', strokeWidth: 2.5 }], 'thick')).toEqual([
      { id: 'A', relation: false, style: { fontSize: 20, lineWidth: 'thick' } },
      { id: 'r1', relation: true, style: { lineWidth: 'thick' } },
      { id: 'T', relation: false, strokeWidth: 5 },
    ]);
  });
});

describe('parseFontSize', () => {
  it('redondea, limita a 8..48 y rechaza lo que no es un número', () => {
    expect(parseFontSize('12.4')).toBe(12);
    expect(parseFontSize('2')).toBe(8);
    expect(parseFontSize('99')).toBe(48);
    expect(parseFontSize('')).toBeUndefined();
    expect(parseFontSize('abc')).toBeUndefined();
  });
});
