import { describe, expect, it } from 'vitest';
import { exportDrawio } from '../../src/export/index.js';
import { textBlockHtml } from '../../src/export/drawio-text.js';
import { importDrawio } from '../../src/import/index.js';
import { layoutDiagram } from '../../src/layout/index.js';
import { type Diagram } from '../../src/model/index.js';
import { validateDiagram } from '../../src/validation/index.js';
import { fixtureNames, loadFixture } from '../support/golden-fixtures.js';

const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => (a.id < b.id ? -1 : 1));

/**
 * Lo que el ida y vuelta tiene que conservar de cada elemento. El trazo se compara por su primer
 * punto absoluto y la imagen sin nombre, porque draw.io no guarda ni el origen del trazo ni el nombre de la imagen.
 */
const essence = (d: Diagram) =>
  byId(d.elements).map((e) => ({
    id: e.id,
    kind: e.kind,
    name: e.kind === 'image' ? undefined : e.kind === 'text' ? textBlockHtml(e.name) : e.name,
    parentId: e.parentId,
    x: e.kind === 'drawing' ? Math.min(...e.points.map((p) => p.x)) + e.layout!.x : e.layout?.x,
    y: e.kind === 'drawing' ? Math.min(...e.points.map((p) => p.y)) + e.layout!.y : e.layout?.y,
  }));
const relationsOf = (d: Diagram) =>
  byId(d.relations).map((r) => ({ id: r.id, kind: r.kind, source: r.source, target: r.target, label: r.label }));

/** Importa el exportado y le calcula el layout como lo haría el hub. */
async function roundTrip(original: Diagram) {
  const { diagram, warnings } = await importDrawio(exportDrawio(original));
  const laid = await layoutDiagram({ ...diagram, id: original.id, revision: 1, createdAt: original.createdAt, updatedAt: original.updatedAt });
  return { laid, warnings, imported: diagram };
}

// Fixtures cuyo draw.io cambia a propósito al reimportar: las claves foráneas pierden su tabla destino y el
// tamaño de letra de referencia (14) no se escribe en el archivo.
const REEXPORT_DIFFERS = ['shop-er-tables', 'styled-c4'];

describe.each(fixtureNames())('ida y vuelta exportar → importar: %s', (name) => {
  it('conserva elementos, relaciones y posiciones', async () => {
    const original = await loadFixture(name);
    const { laid, imported } = await roundTrip(original);
    expect(validateDiagram(imported).ok).toBe(true);
    expect(essence(laid)).toEqual(essence(original));
    expect(relationsOf(laid)).toEqual(relationsOf(original));
  });

  it('exportar de nuevo da el mismo draw.io, salvo lo que draw.io no guarda', async () => {
    const original = await loadFixture(name);
    const { laid } = await roundTrip(original);
    // Las imágenes pierden el nombre y los trazos su esquina de origen: se comparan aparte.
    if (original.elements.some((e) => e.kind === 'image' || e.kind === 'drawing') || REEXPORT_DIFFERS.includes(name)) return;
    expect(exportDrawio(laid)).toBe(exportDrawio(original));
  });
});
