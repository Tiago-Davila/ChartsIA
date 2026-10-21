import { describe, expect, it } from 'vitest';
import { type DiagramInput, ElementSchema } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';

const id = { name: 'id', type: 'INT', pk: true };
const tables = (pedidoColumns: unknown[], clienteColumns: unknown[] = [id, { name: 'email', type: 'TEXT' }]) =>
  ({
    type: 'er',
    title: 'Tablas',
    elements: [
      { id: 'cliente', kind: 'table', name: 'cliente', columns: clienteColumns },
      { id: 'pedido', kind: 'table', name: 'pedido', columns: pedidoColumns },
    ],
    relations: [],
  }) as DiagramInput;
const fk = (table: string, column: string) => ({ name: 'cliente_id', type: 'INT', fk: { table, column } });

function firstError(input: DiagramInput) {
  const res = validateDiagram(input);
  return res.ok ? undefined : res.errors[0];
}

describe('tabla ER', () => {
  it('acepta una FK que apunta a una columna PK', () => {
    expect(validateDiagram(tables([id, fk('cliente', 'id')])).ok).toBe(true);
  });

  it('exige entre 1 y 200 columnas y rechaza campos desconocidos', () => {
    const base = { id: 'T', kind: 'table', name: 'T' };
    expect(ElementSchema.safeParse({ ...base, columns: [] }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, columns: Array.from({ length: 201 }, (_, i) => ({ name: `c${i}`, type: 'INT' })) }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, columns: [{ name: 'a', type: 'INT', visibility: '+' }] }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, columns: [{ name: 'a' }] }).success).toBe(false);
  });

  it('nombres de columna repetidos ⇒ INVALID_MEMBER', () => {
    expect(firstError(tables([id, { name: 'id', type: 'TEXT' }]))).toMatchObject({ code: 'INVALID_MEMBER', path: '/elements/1/columns/1/name' });
  });

  it('FK a una tabla que no existe ⇒ UNKNOWN_REFERENCE', () => {
    expect(firstError(tables([id, fk('nada', 'id')]))).toMatchObject({ code: 'UNKNOWN_REFERENCE', path: '/elements/1/columns/1/fk/table' });
  });

  it('FK a una columna que no existe ⇒ UNKNOWN_REFERENCE con las disponibles', () => {
    const error = firstError(tables([id, fk('cliente', 'zzz')]));
    expect(error).toMatchObject({ code: 'UNKNOWN_REFERENCE', path: '/elements/1/columns/1/fk/column' });
    expect(error!.hint).toContain('email');
  });

  it('FK a una columna que no es PK ⇒ INVALID_MEMBER', () => {
    expect(firstError(tables([id, fk('cliente', 'email')]))).toMatchObject({ code: 'INVALID_MEMBER', path: '/elements/1/columns/1/fk/column' });
  });

  it('las tablas solo valen en diagramas er', () => {
    const res = validateDiagram({ ...tables([id]), type: 'class' } as DiagramInput);
    expect(res.ok ? [] : res.errors.map((e) => e.code)).toContain('KIND_NOT_ALLOWED');
  });
});
