import { describe, expect, it } from 'vitest';
import { highlight } from '../../../src/shapes/text/highlight.js';

/** Pares [texto, clase] de una línea, para comparar sin ruido. */
const pairs = (line: { text: string; kind: string }[]) => line.map((t) => [t.text, t.kind]);

describe('highlight en TypeScript y JavaScript', () => {
  it('marca palabras reservadas, cadenas, números y comentarios de línea', () => {
    const [line] = highlight('const a = "hola" + 42; // nota', 'ts');
    expect(pairs(line!)).toEqual([
      ['const', 'keyword'],
      [' a = ', 'plain'],
      ['"hola"', 'string'],
      [' + ', 'plain'],
      ['42', 'number'],
      ['; ', 'plain'],
      ['// nota', 'comment'],
    ]);
  });

  it('un comentario de bloque que cruza líneas se reparte entre ellas', () => {
    const lines = highlight('/* uno\ndos */ let x', 'js');
    expect(lines.length).toBe(2);
    expect(pairs(lines[0]!)).toEqual([['/* uno', 'comment']]);
    expect(pairs(lines[1]!)).toEqual([['dos */', 'comment'], [' ', 'plain'], ['let', 'keyword'], [' x', 'plain']]);
  });

  it('una cadena sin cerrar termina al final de su línea', () => {
    const lines = highlight('"abierta\nsiguiente', 'ts');
    expect(pairs(lines[0]!)).toEqual([['"abierta', 'string']]);
    expect(pairs(lines[1]!)).toEqual([['siguiente', 'plain']]);
  });

  it('una palabra que empieza como una reservada no se marca', () => {
    const [line] = highlight('constante iffy', 'ts');
    expect(pairs(line!)).toEqual([['constante iffy', 'plain']]);
  });
});

describe('highlight en Python, JSON y SQL', () => {
  it('Python usa # para comentar', () => {
    const [line] = highlight('def f(): return None  # fin', 'python');
    expect(line!.filter((t) => t.kind === 'keyword').map((t) => t.text)).toEqual(['def', 'return', 'None']);
    expect(line!.at(-1)).toEqual({ text: '# fin', kind: 'comment' });
  });

  it('JSON marca true, false y null, sin comentarios', () => {
    const [line] = highlight('{"ok": true, "x": null, "n": 1.5}', 'json');
    expect(line!.filter((t) => t.kind === 'keyword').map((t) => t.text)).toEqual(['true', 'null']);
    expect(line!.filter((t) => t.kind === 'number').map((t) => t.text)).toEqual(['1.5']);
  });

  it('SQL reconoce las palabras en cualquier mayúscula y comenta con --', () => {
    const [line] = highlight('select id from t -- nota', 'sql');
    expect(line!.filter((t) => t.kind === 'keyword').map((t) => t.text)).toEqual(['select', 'from']);
    expect(line!.at(-1)).toEqual({ text: '-- nota', kind: 'comment' });
  });
});

describe('highlight genérico', () => {
  it('un lenguaje desconocido o vacío solo marca cadenas y números', () => {
    const [line] = highlight('const a = "x" + 3 // no', '');
    expect(line!.map((t) => t.kind)).not.toContain('keyword');
    expect(line!.map((t) => t.kind)).not.toContain('comment');
    expect(line!.filter((t) => t.kind === 'string').map((t) => t.text)).toEqual(['"x"']);
    expect(line!.filter((t) => t.kind === 'number').map((t) => t.text)).toEqual(['3']);
  });

  it('código vacío devuelve una línea vacía', () => {
    expect(highlight('', 'ts')).toEqual([[]]);
  });
});
