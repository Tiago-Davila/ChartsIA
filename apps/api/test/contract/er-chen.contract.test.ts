import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const chen = {
  type: 'er',
  title: 'Chen',
  elements: [
    { id: 'cliente', kind: 'entity', name: 'Cliente' },
    { id: 'dni', kind: 'attribute', name: 'DNI', key: true },
    { id: 'tel', kind: 'attribute', name: 'Teléfonos', multivalued: true },
    { id: 'edad', kind: 'attribute', name: 'Edad', derived: true },
    { id: 'estados', kind: 'value-list', name: 'Estados', values: ['activo', 'baja'] },
  ],
  relations: [
    { id: 'a1', kind: 'er-attr', source: 'cliente', target: 'dni' },
    { id: 'a2', kind: 'er-attr', source: 'cliente', target: 'tel' },
    { id: 'a3', kind: 'er-attr', source: 'cliente', target: 'edad' },
    { id: 'a4', kind: 'er-attr', source: 'edad', target: 'estados' },
  ],
};

describe('contract: atributos Chen', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('crea atributos y listas, los dispone y los exporta', async () => {
    const res = await h.call('create_diagram', chen);
    expect(res.isError).toBeFalsy();
    const svg = (await h.call('export_diagram', { format: 'svg' })).structuredContent!.content as string;
    expect(svg).toContain('text-decoration="underline">DNI');
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).toContain('activo');
  });

  it('una er-attr del atributo a la entidad (al revés) ⇒ RELATION_NOT_ALLOWED', async () => {
    const bad = { ...chen, relations: [{ id: 'a1', kind: 'er-attr', source: 'dni', target: 'cliente' }] };
    const res = await h.call('create_diagram', bad);
    expect(h.errorCodes(res)).toEqual(['RELATION_NOT_ALLOWED']);
    expect(res.structuredContent!.errors![0]).toMatchObject({ path: '/relations/0/kind' });
    expect(res.structuredContent!.errors![0]!.hint).toContain('entity→attribute');
  });

  it('una clave multivaluada ⇒ FIELD_NOT_ALLOWED con path y hint', async () => {
    const bad = { ...chen, elements: [chen.elements[0]!, { ...chen.elements[1]!, multivalued: true }, ...chen.elements.slice(2)] };
    const res = await h.call('create_diagram', bad);
    expect(h.errorCodes(res)).toEqual(['FIELD_NOT_ALLOWED']);
    expect(res.structuredContent!.errors![0]).toMatchObject({ path: '/elements/1/multivalued' });
  });

  it('apply_changes añade un atributo con su er-attr y cambia sus marcas', async () => {
    await h.call('create_diagram', chen);
    const res = await h.call('apply_changes', {
      operations: [
        { op: 'add_element', element: { id: 'email', kind: 'attribute', name: 'Email' } },
        { op: 'add_relation', relation: { id: 'a5', kind: 'er-attr', source: 'cliente', target: 'email' } },
        { op: 'update_element', id: 'email', changes: { derived: true } },
        { op: 'update_element', id: 'estados', changes: { values: ['activo', 'baja', 'suspendido'] } },
      ],
    });
    expect(res.isError).toBeFalsy();
  });
});
