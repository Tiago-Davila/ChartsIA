import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const notacionChen = {
  type: 'er',
  title: 'Figuras Chen',
  elements: [
    { id: 'empleado', kind: 'entity', name: 'Empleado' },
    { id: 'dependiente', kind: 'entity', name: 'Dependiente', weak: true },
    { id: 'asignacion', kind: 'entity', name: 'Asignación', associative: true },
    { id: 'trabaja', kind: 'relationship', name: 'Trabaja en' },
    { id: 'tiene', kind: 'relationship', name: 'Tiene', identifying: true },
    { id: 'tipo', kind: 'specialization', name: 'Tipo' },
    { id: 'dep_nombre', kind: 'attribute', name: 'Nombre del dependiente', partialKey: true },
    { id: 'legajo', kind: 'attribute', name: 'Legajo', key: true },
  ],
  relations: [
    { id: 'c1', kind: 'connector', source: 'empleado', target: 'trabaja', label: 'N', arrowheads: 'none', sourceTotal: true },
    { id: 'c2', kind: 'connector', source: 'tiene', target: 'dependiente', label: '1', arrowheads: 'none', targetTotal: true },
    { id: 'c3', kind: 'connector', source: 'empleado', target: 'tipo', arrowheads: 'none' },
    { id: 'a1', kind: 'er-attr', source: 'dependiente', target: 'dep_nombre' },
    { id: 'a2', kind: 'er-attr', source: 'empleado', target: 'legajo' },
  ],
};

describe('contract: figuras ER de Chen', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea rombos, especialización, entidad asociativa y clave parcial, y los exporta', async () => {
    const res = await h.call('create_diagram', notacionChen);
    expect(res.isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('Trabaja en');
    expect(svg).toContain('>d</text>');
    expect(svg).toContain('stroke-dasharray="6 4"');
  });

  it('una clave parcial que también es clave ⇒ FIELD_NOT_ALLOWED con path y hint', async () => {
    const bad = {
      ...notacionChen,
      elements: notacionChen.elements.map((el) => (el.id === 'dep_nombre' ? { ...el, key: true } : el)),
    };
    const res = await h.call('create_diagram', bad);
    expect(h.errorCodes(res)).toContain('FIELD_NOT_ALLOWED');
    const error = res.structuredContent!.errors!.find((e) => e.path === '/elements/6/key');
    expect(error?.hint).toContain('partialKey');
  });

  it('participación total en una er-attr ⇒ FIELD_NOT_ALLOWED', async () => {
    const bad = { ...notacionChen, relations: [{ id: 'a1', kind: 'er-attr', source: 'dependiente', target: 'dep_nombre', sourceTotal: true }] };
    const res = await h.call('create_diagram', bad);
    expect(res.structuredContent!.errors![0]).toMatchObject({ code: 'FIELD_NOT_ALLOWED', path: '/relations/0/sourceTotal' });
  });

  it('apply_changes cambia la identificación del rombo, la asociativa y la participación total', async () => {
    await h.call('create_diagram', notacionChen);
    const res = await h.call('apply_changes', {
      operations: [
        { op: 'update_element', id: 'trabaja', changes: { identifying: true } },
        { op: 'update_element', id: 'asignacion', changes: { associative: null } },
        { op: 'update_element', id: 'tipo', changes: { overlapping: true } },
        { op: 'update_relation', id: 'c3', changes: { sourceTotal: true } },
      ],
    });
    expect(res.isError).toBeFalsy();
  });
});
