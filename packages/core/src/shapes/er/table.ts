import { type ElementOfKind } from '../../model/diagram.js';
import { type Column } from '../../model/er-elements.js';
import { type ShapeDefinition } from '../types.js';
import { boxPrimitives, type CompartmentBox, headerLines, measureBox } from '../uml/compartments.js';

type TableElement = ElementOfKind<'table'>;

/** Texto de una columna: marca de clave, nombre, tipo y restricciones, p. ej. "PK id: INT NOT NULL". */
export function formatColumn(c: Column): string {
  const keys = [c.pk ? 'PK' : '', c.fk ? 'FK' : ''].filter(Boolean).join(' ');
  return [keys, `${c.name}: ${c.type}`, c.notNull ? 'NOT NULL' : '', c.unique ? 'UNIQUE' : ''].filter(Boolean).join(' ');
}

/** Cabecera con el nombre y una fila por columna: la PK va en negrita y subrayada, la FK en cursiva. */
export function tableBox(el: TableElement): CompartmentBox {
  return {
    header: headerLines(el.name, {}),
    style: el.style,
    sections: [el.columns.map((c, i) => ({ text: formatColumn(c), slot: `column:${i}`, bold: c.pk, underline: c.pk, italic: !!c.fk && !c.pk }))],
  };
}

/** Tabla ER: la misma caja de compartimentos que las clases, con una fila por columna. */
export const tableShape: ShapeDefinition<TableElement> = {
  measure: (el) => measureBox(tableBox(el)),
  primitives: (el, size) => boxPrimitives(tableBox(el), size),
};
