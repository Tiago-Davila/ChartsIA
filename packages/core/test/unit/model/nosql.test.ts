import { describe, expect, it } from 'vitest';
import { DiagramInputSchema, ElementSchema, toToolJsonSchema } from '../../../src/model/index.js';
import { NoSqlFieldNameSchema } from '../../../src/model/nosql-elements.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { pngDataUrl } from '../../support/images.js';

const nestedFields = [
  { path: ['cliente'], type: 'object' },
  { path: ['cliente', 'nombre'], type: 'string' },
  { path: ['cliente', 'direcciones'], type: 'array', itemsType: 'object' },
  { path: ['cliente', 'direcciones', 'calle'], type: 'string' },
];

const diagram = (fields: unknown[]) => ({
  type: 'nosql',
  title: 'Pedidos',
  elements: [{ id: 'Pedidos', kind: 'collection', name: 'pedidos', fields }],
  relations: [],
});

describe('modelo NoSQL', () => {
  it('acepta tipos simples y rutas de objetos y arrays de subdocumentos', () => {
    const result = validateDiagram(diagram([
      { path: ['_id'], type: 'objectId' },
      ...nestedFields,
      { path: ['etiquetas'], type: 'array', itemsType: 'string' },
    ]));
    expect(result.ok).toBe(true);
  });

  it('mantiene figuras, trazos e imágenes generales en un diagrama NoSQL', () => {
    const result = validateDiagram({
      type: 'nosql',
      title: 'Pedido',
      elements: [
        { id: 'C', kind: 'collection', name: 'pedidos', fields: [] },
        { id: 'F', kind: 'figure', name: 'Marca', shape: 'circle' },
        { id: 'D', kind: 'drawing', name: 'Trazo', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], strokeColor: '#1f2933', strokeWidth: 2 },
        { id: 'I', kind: 'image', name: 'Sello', src: pngDataUrl({ width: 1, height: 1 }) },
      ],
      relations: [],
    });
    expect(result.ok).toBe(true);
  });

  it('acota profundidad y cantidad de campos antes de validar reglas', () => {
    const tooDeep = { path: Array.from({ length: 9 }, (_, i) => `nivel${i}`), type: 'string' };
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ path: [`campo${i}`], type: 'string' }));
    expect(validateDiagram(diagram([tooDeep])).ok).toBe(false);
    expect(validateDiagram(diagram(tooMany)).ok).toBe(false);
  });

  it('rechaza claves peligrosas como segmento de ruta', () => {
    for (const name of ['__proto__', 'constructor', 'prototype']) {
      expect(NoSqlFieldNameSchema.safeParse(name).success).toBe(false);
    }
    expect(validateDiagram(diagram([{ path: ['__proto__'], type: 'string' }])).ok).toBe(false);
  });

  it('mantiene el esquema apto para JSON Schema MCP y discrimina la colección', () => {
    const input = diagram(nestedFields);
    expect(ElementSchema.safeParse(input.elements[0]).success).toBe(true);
    const schema = JSON.stringify(toToolJsonSchema(DiagramInputSchema));
    expect(schema).toContain('nosql');
    expect(schema).toContain('nosql-rel');
    expect(schema).toContain('__proto__');
    expect(schema).not.toContain('"$ref"');
  });
});
