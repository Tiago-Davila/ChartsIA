import { describe, expect, it } from 'vitest';
import { parseMarkdown, parseRuns } from '../../../src/shapes/text/markdown.js';

describe('parseRuns', () => {
  it('separa negrita y cursiva del texto normal', () => {
    expect(parseRuns('a **b** *c* d')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' d' },
    ]);
  });

  it('deja como texto los asteriscos sin cerrar', () => {
    expect(parseRuns('precio * 2 y **sin cierre')).toEqual([{ text: 'precio * 2 y **sin cierre' }]);
  });
});

describe('parseMarkdown', () => {
  it('reconoce títulos de nivel 1 a 3; más almohadillas cuentan como nivel 3', () => {
    const blocks = parseMarkdown('# Uno\n## Dos\n#### Cuatro');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, runs: [{ text: 'Uno' }] },
      { type: 'heading', level: 2, runs: [{ text: 'Dos' }] },
      { type: 'heading', level: 3, runs: [{ text: 'Cuatro' }] },
    ]);
  });

  it('agrupa las listas con guion y las numeradas en bloques separados', () => {
    const blocks = parseMarkdown('- uno\n- **dos**\n1. primero\n2. segundo');
    expect(blocks).toEqual([
      { type: 'list', ordered: false, items: [[{ text: 'uno' }], [{ text: 'dos', bold: true }]] },
      { type: 'list', ordered: true, items: [[{ text: 'primero' }], [{ text: 'segundo' }]] },
    ]);
  });

  it('une las líneas de un párrafo y separa los párrafos con una línea vacía', () => {
    const blocks = parseMarkdown('primera\nsegunda\n\ntercera');
    expect(blocks).toEqual([
      { type: 'paragraph', lines: [[{ text: 'primera' }], [{ text: 'segunda' }]] },
      { type: 'paragraph', lines: [[{ text: 'tercera' }]] },
    ]);
  });

  it('lee el lenguaje del bloque de código en minúsculas y conserva su texto tal cual', () => {
    const blocks = parseMarkdown('```TS\nconst a = 1;\n  b();\n```');
    expect(blocks).toEqual([{ type: 'code', language: 'ts', code: 'const a = 1;\n  b();' }]);
  });

  it('un bloque de código sin cerrar llega hasta el final del texto', () => {
    expect(parseMarkdown('```py\nx = 1\ny = 2')).toEqual([{ type: 'code', language: 'py', code: 'x = 1\ny = 2' }]);
  });

  it('dentro de un bloque de código el markdown no se interpreta', () => {
    expect(parseMarkdown('```\n# no es título **no**\n```')).toEqual([{ type: 'code', language: '', code: '# no es título **no**' }]);
  });

  it('un guion sin espacio no es una lista', () => {
    expect(parseMarkdown('-sin espacio')).toEqual([{ type: 'paragraph', lines: [[{ text: '-sin espacio' }]] }]);
  });
});
