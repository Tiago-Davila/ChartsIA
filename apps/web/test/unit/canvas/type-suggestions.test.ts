import { describe, expect, it } from 'vitest';
import { applySuggestion, suggestTypes, typeContext } from '../../../src/canvas/type-suggestions';

const at = (text: string) => text.indexOf('|');
const clean = (text: string) => text.replace('|', '');

describe('autocompletado de tipos', () => {
  it.each([
    ['- isbn: Str|', 'attribute', { slot: 'attribute', prefix: 'Str' }],
    ['- total: |int = 0', 'attribute', { slot: 'attribute', prefix: '' }],
    ['+ pagar(monto: Dec|, x: int): void', 'operation', { slot: 'parameter', prefix: 'Dec' }],
    ['+ pagar(monto: Decimal): do|', 'operation', { slot: 'return', prefix: 'do' }],
  ] as const)('typeContext(%s)', (text, field, expected) => {
    expect(typeContext(clean(text), at(text), field)).toMatchObject(expected);
  });

  it.each([
    ['- is|bn: String', 'attribute'],
    ['- total: int = 0|', 'attribute'],
    ['+ pa|gar(): void', 'operation'],
    ['+ pagar(mon|to: int): void', 'operation'],
  ] as const)('fuera de un tipo no sugiere nada (%s)', (text, field) => {
    expect(typeContext(clean(text), at(text), field)).toBeUndefined();
  });

  it('void solo aparece en el retorno de un método', () => {
    const ret = typeContext('+ f(): v', 8, 'operation')!;
    const attr = typeContext('- x: v', 6, 'attribute')!;
    expect(suggestTypes(ret)[0]).toBe('void');
    expect(suggestTypes(attr)).not.toContain('void');
  });

  it('filtra por lo escrito (primero los que empiezan así) e incluye las clases del diagrama', () => {
    const ctx = typeContext('- x: do', 7, 'attribute')!;
    expect(suggestTypes(ctx).slice(0, 2)).toEqual(['double', 'Double']);
    const own = typeContext('- x: Lib', 8, 'attribute')!;
    expect(suggestTypes(own, { elements: [{ id: 'Libro', kind: 'class', name: 'Libro', attributes: [], operations: [] }] })).toContain('Libro');
  });

  it('reemplaza el tipo completo y deja el cursor dentro de los genéricos', () => {
    const ctx = typeContext('- total: int = 0', 10, 'attribute')!;
    expect(applySuggestion('- total: int = 0', ctx, 'double')).toEqual({ text: '- total: double = 0', caret: 15 });
    const gen = typeContext('- xs: Li', 8, 'attribute')!;
    expect(applySuggestion('- xs: Li', gen, 'List<>')).toEqual({ text: '- xs: List<>', caret: 11 });
  });
});
