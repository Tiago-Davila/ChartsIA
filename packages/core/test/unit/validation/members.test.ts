import { describe, expect, it } from 'vitest';
import { validateDiagram } from '../../../src/validation/index.js';
import { classDiagram } from '../../support/fixtures.js';

const method = (extra: Record<string, unknown> = {}) => ({ name: 'f', parameters: [], visibility: '+', default: true, ...extra });

function check(element: Record<string, unknown>) {
  return validateDiagram(classDiagram({ elements: [{ id: 'X', name: 'X', ...element }] as never, relations: [] }));
}

describe('INVALID_MEMBER', () => {
  it('acepta default en una interfaz', () => {
    expect(check({ kind: 'interface', operations: [method()] }).ok).toBe(true);
  });

  it.each([
    ['class', { kind: 'class', attributes: [], operations: [method()] }],
    ['enum', { kind: 'enum', literals: ['A'], operations: [method()] }],
  ])('rechaza default en %s con path, message y hint', (_, el) => {
    const res = check(el);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toEqual([
        { code: 'INVALID_MEMBER', path: '/elements/0/operations/0/default', message: expect.any(String), hint: expect.any(String) },
      ]);
    }
  });

  it.each([{ abstract: true }, { static: true }])('rechaza default con %o', (extra) => {
    const res = check({ kind: 'interface', operations: [method(extra)] });
    expect(!res.ok && res.errors[0]?.code).toBe('INVALID_MEMBER');
  });
});
