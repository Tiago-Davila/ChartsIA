import { describe, expect, it } from 'vitest';
import {
  DiagramInputSchema,
  OperationBatchSchema,
  toToolJsonSchema,
} from '../../../src/model/index.js';

type Json = Record<string, unknown>;

function walk(node: unknown, visit: (n: Json, path: string) => void, path = '#'): void {
  if (Array.isArray(node)) node.forEach((n, i) => walk(n, visit, `${path}/${i}`));
  else if (node && typeof node === 'object') {
    visit(node as Json, path);
    for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}/${k}`);
  }
}

describe.each([
  ['DiagramInput', DiagramInputSchema],
  ['OperationBatch', OperationBatchSchema],
])('subconjunto JSON Schema común (%s)', (_name, schema) => {
  const json = toToolJsonSchema(schema);

  it('todo objeto declara additionalProperties: false', () => {
    walk(json, (n, path) => {
      if (n.type === 'object') expect(n.additionalProperties, path).toBe(false);
    });
  });

  it('no usa oneOf, $ref, $defs ni format', () => {
    walk(json, (n, path) => {
      expect(n, path).not.toHaveProperty('oneOf');
      expect(n, path).not.toHaveProperty('$ref');
      expect(n, path).not.toHaveProperty('$defs');
      expect(n, path).not.toHaveProperty('format');
    });
  });

  it('expresa las uniones con anyOf', () => {
    let unions = 0;
    walk(json, (n) => {
      if (Array.isArray(n.anyOf)) unions++;
    });
    expect(unions).toBeGreaterThan(0);
  });
});
