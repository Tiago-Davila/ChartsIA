import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ERROR_CODES } from '../../../src/model/index.js';
import { fromZodError, toJsonPointer, validateDiagram } from '../../../src/validation/index.js';
import { classDiagram, codes } from '../../support/fixtures.js';

describe('LIMIT_EXCEEDED', () => {
  it('rechaza más elementos que el máximo, contando grupos', () => {
    const d = classDiagram();
    d.elements.push({ id: 'pkg', kind: 'package', name: 'pkg' });
    const res = validateDiagram(d, { maxElements: 4 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const err = res.errors.find((e) => e.code === 'LIMIT_EXCEEDED');
      expect(err?.path).toBe('/elements');
      expect(err?.message).toContain('4');
    }
    expect(validateDiagram(d, { maxElements: 5 }).ok).toBe(true);
  });

  it('usa 500 como máximo por defecto', () => {
    const d = classDiagram({ relations: [] });
    d.elements = Array.from({ length: 501 }, (_, i) => ({ id: `C${i}`, kind: 'enum' as const, name: `C${i}`, literals: ['A'] }));
    const res = validateDiagram(d);
    expect(!res.ok && codes(res.errors)).toContain('LIMIT_EXCEEDED');
  });
});

describe('forma de los errores', () => {
  it('cada error tiene code, path JSON Pointer, message y hint', () => {
    const d = classDiagram();
    d.relations[0]!.target = 'X';
    d.elements.push({ id: 'Libro', kind: 'class', name: 'Dup', attributes: [], operations: [] });
    const res = validateDiagram(d);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.length).toBeGreaterThanOrEqual(2);
      for (const e of res.errors) {
        expect(ERROR_CODES).toContain(e.code);
        expect(e.path).toMatch(/^(\/[^/]*)*$/);
        expect(e.message.length).toBeGreaterThan(0);
        expect(e.hint.length).toBeGreaterThan(0);
        expect(Object.keys(e).sort()).toEqual(['code', 'hint', 'message', 'path']);
      }
    }
  });

  it('el resultado es todo o nada: con un error no se devuelve valor', () => {
    const d = classDiagram();
    d.relations[1]!.source = 'Nadie';
    const res = validateDiagram(d);
    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty('value');
  });
});

describe('SCHEMA_VIOLATION', () => {
  it('convierte errores de Zod con path JSON Pointer al campo', () => {
    const d = classDiagram();
    (d.elements[2] as { name: string }).name = '';
    const res = validateDiagram(d);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/elements/2/name' });
    }
  });

  it('las reglas de dominio no se evalúan si el esquema falla', () => {
    const res = validateDiagram({ type: 'class', title: 'T', elements: [{ id: 'A' }], relations: [{ id: 'r' }] });
    expect(!res.ok && new Set(codes(res.errors))).toEqual(new Set(['SCHEMA_VIOLATION']));
  });

  it('fromZodError antepone un prefijo y escapa ~ y /', () => {
    const schema = z.object({ 'a/b': z.object({ 'c~d': z.string() }) });
    const parsed = schema.safeParse({ 'a/b': { 'c~d': 1 } });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const [err] = fromZodError(parsed.error, '/operations/3');
      expect(err?.path).toBe('/operations/3/a~1b/c~0d');
    }
    expect(toJsonPointer([])).toBe('');
    expect(toJsonPointer(['elements', 0, 'id'])).toBe('/elements/0/id');
  });
});
