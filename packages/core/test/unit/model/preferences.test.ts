import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  type Element,
  mergePreferences,
  PreferenceChangesSchema,
  PreferencesSchema,
  styleElement,
  styleRelation,
  toToolJsonSchema,
} from '../../../src/model/index.js';

const clase: Element = { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [] };

describe('preferencias de diagrama', () => {
  it('las preferencias por defecto son válidas y completas', () => {
    expect(PreferencesSchema.safeParse(DEFAULT_PREFERENCES).success).toBe(true);
  });

  it('rechaza campos desconocidos y valores fuera de lista', () => {
    expect(PreferenceChangesSchema.safeParse({ direccion: 'down' }).success).toBe(false);
    expect(PreferenceChangesSchema.safeParse({ direction: 'up' }).success).toBe(false);
    expect(PreferenceChangesSchema.safeParse({ uml: { colores: true } }).success).toBe(false);
    expect(PreferenceChangesSchema.safeParse({ palette: { circle: { fillColor: '#ffffff' } } }).success).toBe(false);
    expect(PreferenceChangesSchema.safeParse({ palette: { class: { fillColor: 'rojo' } } }).success).toBe(false);
  });

  it('mergePreferences cambia solo lo pedido y quita colores con null', () => {
    const una = mergePreferences(DEFAULT_PREFERENCES, { direction: 'right', uml: { methods: false }, palette: { class: { fillColor: '#ffffff' }, enum: { fontColor: '#000000' } } });
    expect(una).toMatchObject({ direction: 'right', elementSpacing: 'normal', uml: { types: true, methods: false }, palette: { class: { fillColor: '#ffffff' } } });
    const dos = mergePreferences(una, { palette: { class: null } });
    expect(dos.palette).toEqual({ enum: { fontColor: '#000000' } });
    expect(DEFAULT_PREFERENCES.palette).toEqual({});
  });

  it('el JSON Schema de los cambios es estricto', () => {
    const schema = toToolJsonSchema(PreferenceChangesSchema) as { additionalProperties?: boolean; properties: Record<string, { additionalProperties?: boolean }> };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.uml!.additionalProperties).toBe(false);
    expect(schema.properties.palette!.additionalProperties).toBe(false);
  });
});

describe('estilo desde las preferencias', () => {
  it('con las preferencias por defecto no toca nada', () => {
    expect(styleElement(clase, DEFAULT_PREFERENCES)).toBe(clase);
    expect(styleRelation({ id: 'r', kind: 'association', source: 'A', target: 'B' }, DEFAULT_PREFERENCES).style).toBeUndefined();
  });

  it('suma colores y fuente, y el estilo propio del elemento gana', () => {
    const prefs = mergePreferences(DEFAULT_PREFERENCES, { fontFamily: 'serif', palette: { class: { fillColor: '#111111', borderColor: '#222222' } } });
    const out = styleElement({ ...clase, style: { fillColor: '#abcdef' } }, prefs);
    expect(out.style).toEqual({ fontFamily: 'serif', fillColor: '#abcdef', borderColor: '#222222' });
  });

  it('no estila trazos ni imágenes, y los tipos sin paleta solo reciben la fuente', () => {
    const prefs = mergePreferences(DEFAULT_PREFERENCES, { fontFamily: 'monospace', palette: { class: { fillColor: '#111111' } } });
    const dibujo = { id: 'D', kind: 'drawing', name: 'D' } as unknown as Element;
    expect(styleElement(dibujo, prefs)).toBe(dibujo);
    expect(styleElement({ id: 'F', kind: 'figure', name: 'F' } as unknown as Element, prefs).style).toEqual({ fontFamily: 'monospace' });
  });

  it('las relaciones solo reciben la fuente', () => {
    const prefs = mergePreferences(DEFAULT_PREFERENCES, { fontFamily: 'handwritten' });
    expect(styleRelation({ id: 'r', kind: 'association', source: 'A', target: 'B', style: { lineWidth: 'thick' } }, prefs).style).toEqual({ fontFamily: 'handwritten', lineWidth: 'thick' });
  });
});
