import { describe, expect, it } from 'vitest';
import {
  DRAWING_DEFAULT_WIDTH,
  DRAWING_MAX_STROKE_WIDTH,
  DRAWING_MIN_STROKE_WIDTH,
  DRAWING_WIDTH_PX,
  ElementSchema,
  FONT_FAMILIES,
  LINE_WIDTHS,
  LINE_WIDTH_PX,
  OperationBatchSchema,
  RelationSchema,
  StyleSchema,
  toToolJsonSchema,
} from '../../../src/model/index.js';

const completo = { borderColor: '#112233', fillColor: '#AABBCC', fontColor: '#000000', fontFamily: 'serif', fontSize: 14 };

describe('StyleSchema', () => {
  it('acepta un estilo completo y uno parcial', () => {
    expect(StyleSchema.safeParse(completo).success).toBe(true);
    expect(StyleSchema.safeParse({ fillColor: '#ffffff' }).success).toBe(true);
  });

  it.each(['red', '#fff', '#12345', '#1234567', '112233', '#gggggg', 'rgb(0,0,0)'])('rechaza el color "%s"', (color) => {
    for (const campo of ['borderColor', 'fillColor', 'fontColor']) {
      expect(StyleSchema.safeParse({ [campo]: color }).success, campo).toBe(false);
    }
  });

  it.each(FONT_FAMILIES)('acepta la fuente "%s"', (fontFamily) => {
    expect(StyleSchema.safeParse({ fontFamily }).success).toBe(true);
  });

  it('rechaza una fuente fuera de la lista', () => {
    expect(StyleSchema.safeParse({ fontFamily: 'Comic Sans' }).success).toBe(false);
  });

  it.each([8, 12, 48])('acepta el tamaño %s', (fontSize) => {
    expect(StyleSchema.safeParse({ fontSize }).success).toBe(true);
  });

  it.each([7, 49, 0, -1, 12.5, '12'])('rechaza el tamaño %s', (fontSize) => {
    expect(StyleSchema.safeParse({ fontSize }).success).toBe(false);
  });

  it.each(LINE_WIDTHS)('acepta el grosor "%s"', (lineWidth) => {
    expect(StyleSchema.safeParse({ lineWidth }).success).toBe(true);
  });

  it.each(['fino', 'bold', 2, '', null])('rechaza el grosor %s', (lineWidth) => {
    expect(StyleSchema.safeParse({ lineWidth }).success).toBe(false);
  });

  it('el grosor medio equivale al que siempre usaron las formas', () => {
    expect(LINE_WIDTH_PX.medium).toBe(1.5);
    expect(LINE_WIDTH_PX.thin).toBeLessThan(LINE_WIDTH_PX.medium);
    expect(LINE_WIDTH_PX.thick).toBeGreaterThan(LINE_WIDTH_PX.medium);
  });

  it('las opciones del lápiz son válidas para un trazo y medium es el grosor por defecto', () => {
    expect(DRAWING_WIDTH_PX.medium).toBe(DRAWING_DEFAULT_WIDTH);
    for (const width of Object.values(DRAWING_WIDTH_PX)) {
      expect(width).toBeGreaterThanOrEqual(DRAWING_MIN_STROKE_WIDTH);
      expect(width).toBeLessThanOrEqual(DRAWING_MAX_STROKE_WIDTH);
    }
  });

  it('rechaza campos desconocidos', () => {
    expect(StyleSchema.safeParse({ color: '#000000' }).success).toBe(false);
  });

  it('elementos y relaciones lo admiten y lo conservan', () => {
    const element = { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [], style: completo };
    const relation = { id: 'r', kind: 'association', source: 'A', target: 'B', style: { borderColor: '#112233' } };
    expect(ElementSchema.parse(element)).toEqual(element);
    expect(RelationSchema.parse(relation)).toEqual(relation);
  });

  it('update_element y update_relation aceptan style y null', () => {
    const ops = [
      { op: 'update_element', id: 'A', changes: { style: { fillColor: '#ffffff' } } },
      { op: 'update_relation', id: 'r', changes: { style: null } },
    ];
    expect(OperationBatchSchema.safeParse(ops).success).toBe(true);
    expect(OperationBatchSchema.safeParse([{ op: 'update_element', id: 'A', changes: { style: { fillColor: 'rojo' } } }]).success).toBe(false);
  });

  it('el JSON Schema de style es estricto y lista fuentes y rango', () => {
    const json = toToolJsonSchema(StyleSchema) as { additionalProperties: boolean; properties: Record<string, Record<string, unknown>> };
    expect(json.additionalProperties).toBe(false);
    expect(json.properties.fontFamily!.enum).toEqual([...FONT_FAMILIES]);
    expect(json.properties.lineWidth!.enum).toEqual([...LINE_WIDTHS]);
    expect(json.properties.fontSize).toMatchObject({ type: 'integer', minimum: 8, maximum: 48 });
    expect(json.properties.fillColor).toHaveProperty('pattern');
  });
});
