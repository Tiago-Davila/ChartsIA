import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const cls = (id: string) => ({ id, kind: 'class', name: id, attributes: [], operations: [] });
const uml = (relations: unknown[]) => ({ type: 'class', title: 'UML', elements: [cls('A'), cls('B')], relations });

describe('contract: relaciones según el tipo de diagrama', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  it('create_diagram class con composition se crea', async () => {
    const res = await h.call('create_diagram', uml([{ id: 'r', kind: 'composition', source: 'A', target: 'B' }]));
    expect(res.isError).toBeFalsy();
  });

  it('create_diagram class con connector entre clases ⇒ RELATION_NOT_ALLOWED con hint', async () => {
    const res = await h.call('create_diagram', uml([{ id: 'r', kind: 'connector', source: 'A', target: 'B' }]));
    expect(h.errorCodes(res)).toEqual(['RELATION_NOT_ALLOWED']);
    expect(res.structuredContent!.errors![0]!.hint).toContain('association');
  });

  it('create_diagram class con er-rel ⇒ RELATION_NOT_ALLOWED', async () => {
    const input = {
      type: 'class',
      title: 'Mezcla',
      elements: [{ id: 'E1', kind: 'entity', name: 'E1' }, { id: 'E2', kind: 'entity', name: 'E2' }],
      relations: [{ id: 'r', kind: 'er-rel', source: 'E1', target: 'E2', sourceCardinality: 'one', targetCardinality: 'zero-many' }],
    };
    expect(h.errorCodes(await h.call('create_diagram', input))).toEqual(['RELATION_NOT_ALLOWED']);
  });

  it('apply_changes rechaza una flecha de otro tipo y no cambia el diagrama', async () => {
    await h.call('create_diagram', uml([]));
    const res = await h.call('apply_changes', { operations: [{ op: 'add_relation', relation: { id: 'r', kind: 'connector', source: 'A', target: 'B' } }] });
    expect(h.errorCodes(res)).toEqual(['RELATION_NOT_ALLOWED']);
  });
});
