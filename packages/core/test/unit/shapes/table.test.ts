import { describe, expect, it } from 'vitest';
import type { Element } from '../../../src/model/index.js';
import { elementPrimitives, measureElement } from '../../../src/shapes/index.js';

const table = (columns: unknown[]): Element => ({ id: 'T', kind: 'table', name: 'cliente', columns }) as Element;
const cols = [
  { name: 'id', type: 'INT', pk: true, notNull: true },
  { name: 'dueno_id', type: 'INT', fk: { table: 'U', column: 'id' } },
  { name: 'email', type: 'VARCHAR(255)', unique: true },
];
const texts = (el: Element) => elementPrimitives(el, measureElement(el)).filter((p) => p.type === 'text');

describe('forma table', () => {
  it('dibuja una fila por columna con las claves resaltadas', () => {
    expect(texts(table(cols))).toMatchObject([
      { text: 'cliente', slot: 'name' },
      { text: 'PK id: INT NOT NULL', slot: 'column:0', bold: true, underline: true },
      { text: 'FK dueno_id: INT', slot: 'column:1', italic: true },
      { text: 'email: VARCHAR(255) UNIQUE', slot: 'column:2' },
    ]);
  });

  it('crece una fila por columna y el ancho sigue a la columna más larga', () => {
    const one = measureElement(table(cols.slice(0, 1)));
    const three = measureElement(table(cols));
    expect(three.height).toBeGreaterThan(one.height);
    const long = measureElement(table([{ name: 'columna_con_un_nombre_larguisimo_para_ensanchar', type: 'VARCHAR(255)', notNull: true, unique: true }]));
    expect(long.width).toBeGreaterThan(three.width);
  });
});
