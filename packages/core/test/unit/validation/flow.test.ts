import { describe, expect, it } from 'vitest';
import { FLOW_EDGE_TYPES, FLOW_VARIANTS } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';

const elements = [
  { id: 'A', kind: 'flow-node', variant: 'trigger', name: 'POST /orders' },
  { id: 'B', kind: 'flow-node', variant: 'decision', name: '¿Hay stock?', subtitle: 'inventory.isAvailable()' },
  { id: 'C', kind: 'flow-node', variant: 'database', name: 'orders' },
  { id: 'F', kind: 'frame', name: 'Módulo' },
  { id: 'P', kind: 'package', name: 'Paquete' },
  { id: 'K', kind: 'class', name: 'K', attributes: [], operations: [] },
];

const flow = (relations: unknown[], extra: unknown[] = []) => validateDiagram({ type: 'flow', title: 'Pedido', elements: [...elements, ...extra], relations });
const errors = (result: ReturnType<typeof flow>) => (result.ok ? [] : result.errors);

describe('validación de flujos', () => {
  it('acepta las 9 variantes y los 6 tipos de conexión', () => {
    const nodes = FLOW_VARIANTS.map((variant) => ({ id: `n-${variant}`, kind: 'flow-node', variant, name: variant }));
    const relations = FLOW_EDGE_TYPES.map((flowType) => ({ id: `e-${flowType}`, kind: 'flow-edge', source: 'n-file', target: 'n-database', flowType, label: 'x' }));
    expect(validateDiagram({ type: 'flow', title: 'Todo', elements: nodes, relations }).ok).toBe(true);
  });

  it('rechaza una variante inexistente con path al campo', () => {
    const result = validateDiagram({ type: 'flow', title: 'T', elements: [{ id: 'A', kind: 'flow-node', variant: 'robot', name: 'A' }], relations: [] });
    expect(errors(result)).toContainEqual(expect.objectContaining({ code: 'SCHEMA_VIOLATION', path: '/elements/0/variant' }));
  });

  it('exige la variante del nodo', () => {
    const result = validateDiagram({ type: 'flow', title: 'T', elements: [{ id: 'A', kind: 'flow-node', name: 'A' }], relations: [] });
    expect(errors(result)).toContainEqual(expect.objectContaining({ path: '/elements/0/variant' }));
  });

  it('rechaza un tipo de conexión inexistente', () => {
    const result = flow([{ id: 'r', kind: 'flow-edge', source: 'A', target: 'C', flowType: 'vuela' }]);
    expect(errors(result)).toContainEqual(expect.objectContaining({ code: 'SCHEMA_VIOLATION', path: '/relations/0/flowType' }));
  });

  it('une nodos de flujo y frames, pero no clases ni otros grupos', () => {
    expect(flow([{ id: 'r', kind: 'flow-edge', source: 'A', target: 'F' }]).ok).toBe(true);
    for (const target of ['K', 'P']) {
      const result = flow([{ id: 'r', kind: 'flow-edge', source: 'A', target }]);
      expect(errors(result)).toContainEqual(expect.objectContaining({ code: 'RELATION_NOT_ALLOWED', path: '/relations/0/kind' }));
    }
  });

  it('no deja unir nodos de flujo con relaciones de otras familias', () => {
    const result = flow([{ id: 'r', kind: 'association', source: 'A', target: 'C' }]);
    expect(errors(result)).toContainEqual(expect.objectContaining({ code: 'RELATION_NOT_ALLOWED' }));
  });

  it('exige etiqueta en las salidas de una decisión', () => {
    const result = flow([{ id: 'r', kind: 'flow-edge', source: 'B', target: 'C' }]);
    expect(errors(result)).toContainEqual(expect.objectContaining({ code: 'FIELD_REQUIRED', path: '/relations/0/label', hint: expect.stringContaining('label') }));
    expect(flow([{ id: 'r', kind: 'flow-edge', source: 'B', target: 'C', label: 'sí' }]).ok).toBe(true);
    expect(flow([{ id: 'r', kind: 'flow-edge', source: 'C', target: 'B' }]).ok).toBe(true);
  });

  it('flowType solo se admite en flow-edge', () => {
    const result = flow([{ id: 'r', kind: 'connector', source: 'A', target: 'C', flowType: 'call' }]);
    expect(errors(result)).toContainEqual(expect.objectContaining({ code: 'FIELD_NOT_ALLOWED', path: '/relations/0/flowType' }));
  });
});
