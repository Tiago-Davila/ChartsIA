import { z } from 'zod';

type JsonObject = Record<string, unknown>;

/** Claves que algunos clientes (OpenAI, Claude) no admiten o interpretan distinto. */
const DROPPED_KEYS = new Set(['$schema', 'format', '$id', 'id']);

function normalize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalize);
  if (!node || typeof node !== 'object') return node;
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(node as JsonObject)) {
    if (DROPPED_KEYS.has(key) && typeof value !== 'object') continue;
    if (key === 'oneOf') out.anyOf = normalize(value);
    else out[key] = normalize(value);
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

/**
 * Convierte un esquema Zod al subconjunto de JSON Schema común a Claude y OpenAI
 * (research R3): objetos cerrados, uniones como `anyOf`, sin `$ref` ni `format`.
 */
export function toToolJsonSchema(schema: z.ZodType): JsonObject {
  const json = z.toJSONSchema(schema, { io: 'input', reused: 'inline', unrepresentable: 'any' });
  return normalize(json) as JsonObject;
}
