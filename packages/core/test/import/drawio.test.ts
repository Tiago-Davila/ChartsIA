import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { importDrawio, MAX_DRAWIO_SOURCE_LENGTH } from '../../src/import/index.js';
import { isDomainValidationError, validateDiagram, type ValidationError } from '../../src/validation/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8');

/** Arma un mxGraphModel mínimo con las celdas dadas. */
const model = (cells: string) => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
const box = (id: string, value: string, x: number, y: number, style = 'rounded=0;whiteSpace=wrap;html=1;', parent = '1') =>
  `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="120" height="60" as="geometry"/></mxCell>`;

/** Comprime como draw.io: deflate crudo del XML codificado como URL, en base64. */
const compress = (xml: string) => deflateRawSync(Buffer.from(encodeURIComponent(xml))).toString('base64');

/** Espera que la importación falle y devuelve el primer error en el formato común. */
async function failure(source: string): Promise<ValidationError> {
  try {
    await importDrawio(source);
  } catch (error) {
    if (!isDomainValidationError(error)) throw error;
    return error.errors[0]!;
  }
  throw new Error('La importación debía fallar.');
}

describe('importDrawio: archivos de draw.io', () => {
  it('importa un .drawio sin comprimir hecho en draw.io: clases, miembros, estilos y relaciones', async () => {
    const { diagram, warnings } = await importDrawio(fixture('foreign-uml.drawio'));
    expect(diagram.title).toBe('Clases de la tienda');
    expect(diagram.type).toBe('class');
    expect(validateDiagram(diagram).ok).toBe(true);

    const cliente = diagram.elements.find((e) => e.kind === 'class' && e.name === 'Cliente');
    expect(cliente).toMatchObject({
      attributes: [{ name: 'nombre', type: 'String', visibility: '-' }],
      operations: [{ name: 'comprar', visibility: '+', returnType: 'Pedido', parameters: [{ name: 'item', type: 'Map<K,V>' }, { name: 'cantidad', type: 'int' }] }],
      layout: { x: 40, y: 40 },
    });
    expect(diagram.elements.find((e) => e.name === 'Pedido')).toMatchObject({
      attributes: [{ name: 'total', type: 'Decimal', visibility: '#' }],
      style: { fillColor: '#dae8fc', borderColor: '#6c8ebf' },
    });
    expect(diagram.elements.find((e) => e.kind === 'figure')).toMatchObject({ shape: 'rectangle', name: 'Nota\nimportante', style: { fillColor: '#fff2cc' } });
    // Los ids de draw.io que no son válidos en el modelo se reemplazan, y las relaciones los siguen.
    const ids = new Set(diagram.elements.map((e) => e.id));
    expect(diagram.relations).toHaveLength(2);
    for (const relation of diagram.relations) {
      expect(ids.has(relation.source) && ids.has(relation.target)).toBe(true);
      expect(relation).toMatchObject({ kind: 'association', navigable: 'source-to-target' });
    }
    expect(diagram.relations.map((r) => r.label)).toEqual(['1', 'realiza\npedidos']);
    expect(warnings).toEqual(expect.arrayContaining([expect.stringContaining('cylinder3'), expect.stringContaining('"14"')]));
  });

  it('el diagrama comprimido (deflate + base64) da el mismo resultado que el sin comprimir', async () => {
    const plain = await importDrawio(fixture('foreign-uml.drawio'));
    const packed = await importDrawio(fixture('foreign-uml-compressed.drawio'));
    expect(packed.diagram).toEqual(plain.diagram);
    expect(packed.warnings).toEqual(plain.warnings);
  });

  it('acepta el cuerpo comprimido suelto y el comprimido en zlib', async () => {
    const xml = model(box('a', 'Uno', 10, 20));
    expect((await importDrawio(compress(xml))).diagram.elements).toHaveLength(1);
    const cdata = `<mxfile><diagram name="Z">${compress(xml)}</diagram></mxfile>`;
    expect((await importDrawio(cdata)).diagram.title).toBe('Z');
  });

  it('importa un mxGraphModel suelto, como lo copia draw.io, también codificado como URL', async () => {
    const plain = await importDrawio(fixture('clipboard.xml'));
    expect(plain.diagram.elements.map((e) => [e.name, e.kind])).toEqual([['Servidor', 'figure'], ['Cliente & navegador', 'figure']]);
    expect(plain.diagram.relations).toMatchObject([{ kind: 'connector', label: 'HTTPS', source: 'a2', target: 'a1', arrowheads: 'end' }]);
    expect(plain.diagram.title).toBe('Diagrama importado');
    const encoded = await importDrawio(fixture('clipboard-encoded.txt'));
    expect(encoded.diagram).toEqual(plain.diagram);
  });

  it('ignora el BOM y los espacios alrededor del XML', async () => {
    const { diagram } = await importDrawio('\uFEFF\n  ' + fixture('clipboard.xml') + '\n');
    expect(diagram.elements).toHaveLength(2);
  });

  it('con varias páginas importa la primera y avisa de las demás', async () => {
    const { diagram, warnings } = await importDrawio(fixture('multipage.drawio'));
    expect(diagram.title).toBe('Primera');
    expect(diagram.elements.map((e) => e.name)).toEqual(['Inicio']);
    expect(warnings).toEqual([expect.stringMatching(/3 páginas.*"Segunda".*"Tercera"/)]);
  });

  it('el título recibido gana al nombre de la página y se recorta a 120 caracteres', async () => {
    expect((await importDrawio(fixture('multipage.drawio'), '  Mi título  ')).diagram.title).toBe('Mi título');
    expect((await importDrawio(fixture('clipboard.xml'), 'x'.repeat(200))).diagram.title).toHaveLength(120);
  });
});

describe('importDrawio: geometría, grupos y formas', () => {
  it('suma el origen del contenedor a los hijos y los deja dentro de su marco', async () => {
    const frame = box('marco', 'Zona', 100, 200, 'rounded=1;container=1;collapsible=0;html=1;');
    const { diagram } = await importDrawio(model(frame + box('hijo', 'Dentro', 30, 40, 'rounded=0;', 'marco')));
    const child = diagram.elements.find((e) => e.id === 'hijo')!;
    expect(child).toMatchObject({ parentId: 'marco', layout: { x: 130, y: 240 } });
    expect(diagram.elements.find((e) => e.id === 'marco')).toMatchObject({ kind: 'frame', name: 'Zona' });
  });

  it('un grupo invisible de draw.io no se vuelve un marco: sus hijos quedan sueltos y en su sitio', async () => {
    const group = '<mxCell id="g" value="" style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="50" y="50" width="200" height="100" as="geometry"/></mxCell>';
    const { diagram } = await importDrawio(model(group + box('x', 'Uno', 10, 10, 'rounded=0;', 'g')));
    expect(diagram.elements).toMatchObject([{ id: 'x', layout: { x: 60, y: 60 } }]);
    expect(diagram.elements[0]!.parentId).toBeUndefined();
  });

  it('reconoce las formas generales de draw.io y avisa de las que no tiene', async () => {
    const shapes = box('s1', 'a', 0, 0, 'ellipse;aspect=fixed;') + box('s2', 'b', 0, 0, 'rhombus;') + box('s3', 'c', 0, 0, 'shape=hexagon;perimeter=hexagonPerimeter2;') + box('s4', 'd', 0, 0, 'shape=singleArrow;direction=west;') + box('s5', 'e', 0, 0, 'shape=process;');
    const { diagram, warnings } = await importDrawio(model(shapes));
    expect(diagram.elements.map((e) => (e.kind === 'figure' ? e.shape : e.kind))).toEqual(['circle', 'diamond', 'hexagon', 'arrow-left']);
    expect(warnings).toEqual([expect.stringContaining('"process"')]);
  });

  it('convierte una línea suelta sin puntas en un trazo con sus puntos relativos', async () => {
    const line = '<mxCell id="t" value="" style="endArrow=none;startArrow=none;strokeColor=#ff0000;strokeWidth=4;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="100" y="200" as="sourcePoint"/><mxPoint x="160" y="260" as="targetPoint"/><Array as="points"><mxPoint x="130" y="190"/></Array></mxGeometry></mxCell>';
    const { diagram } = await importDrawio(model(box('x', 'Uno', 0, 0) + line));
    expect(diagram.elements.find((e) => e.kind === 'drawing')).toMatchObject({
      layout: { x: 100, y: 190 },
      points: [{ x: 0, y: 10 }, { x: 30, y: 0 }, { x: 60, y: 70 }],
      strokeColor: '#ff0000',
      strokeWidth: 4,
    });
  });

  it('lee elementos C4 de la librería de draw.io', async () => {
    const person = '<object placeholders="1" c4Name="Cliente" c4Type="Person" c4Description="Compra" label="%c4Name%" id="p"><mxCell style="shape=mxgraph.c4.person2;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="200" height="180" as="geometry"/></mxCell></object>';
    const web = '<object placeholders="1" c4Name="Web" c4Type="Container" c4Technology="React" label="x" id="w"><mxCell style="rounded=1;" vertex="1" parent="1"><mxGeometry x="300" y="0" width="240" height="120" as="geometry"/></mxCell></object>';
    const rel = '<object placeholders="1" c4Type="Relationship" c4Technology="HTTPS" label="Usa" id="r"><mxCell style="endArrow=blockThin;endFill=1;dashed=1;" edge="1" parent="1" source="p" target="w"><mxGeometry relative="1" as="geometry"/></mxCell></object>';
    const { diagram } = await importDrawio(model(person + web + rel));
    expect(diagram.type).toBe('c4-container');
    expect(diagram.elements).toMatchObject([{ kind: 'person', name: 'Cliente', description: 'Compra' }, { kind: 'container', name: 'Web', technology: 'React' }]);
    expect(diagram.relations).toMatchObject([{ kind: 'c4-rel', label: 'Usa', technology: 'HTTPS' }]);
  });

  it('una arista que no cumple las reglas del modelo se importa como conector con aviso', async () => {
    const inheritance = '<mxCell id="e" value="" style="endArrow=block;endFill=0;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>';
    const swim = (id: string, name: string, x: number) =>
      `<mxCell id="${id}" value="${name}" style="swimlane;childLayout=stackLayout;horizontal=1;startSize=26;" vertex="1" parent="1"><mxGeometry x="${x}" y="0" width="100" height="60" as="geometry"/></mxCell>`;
    const iface = `<mxCell id="b" value="«interface»&#xa;Pagable" style="swimlane;childLayout=stackLayout;horizontal=1;startSize=26;" vertex="1" parent="1"><mxGeometry x="200" y="0" width="100" height="60" as="geometry"/></mxCell>`;
    const { diagram, warnings } = await importDrawio(model(swim('a', 'Pedido', 0) + iface + inheritance));
    expect(diagram.elements.map((e) => e.kind)).toEqual(['class', 'interface']);
    expect(diagram.relations).toMatchObject([{ kind: 'connector', arrowheads: 'end' }]);
    expect(warnings).toEqual([expect.stringContaining('inheritance')]);
  });
});

describe('importDrawio: seguridad y límites', () => {
  it('rechaza DOCTYPE y entidades externas sin expandirlas', async () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE mxfile [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><mxfile><diagram name="&xxe;">${model(box('a', '&xxe;', 0, 0))}</diagram></mxfile>`;
    expect(await failure(xxe)).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/source', message: expect.stringContaining('DOCTYPE'), hint: expect.any(String) });
  });

  it('rechaza una bomba de entidades (billion laughs) antes de expandir nada', async () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><mxGraphModel><root>&b;</root></mxGraphModel>';
    expect(await failure(bomb)).toMatchObject({ code: 'SCHEMA_VIOLATION', path: '/source' });
  });

  it('rechaza el DOCTYPE también dentro de un diagrama comprimido', async () => {
    const hidden = `<!DOCTYPE x [<!ENTITY e "boom">]>${model(box('a', '&e;', 0, 0))}`;
    expect(await failure(`<mxfile><diagram name="P">${compress(hidden)}</diagram></mxfile>`)).toMatchObject({ code: 'SCHEMA_VIOLATION', message: expect.stringContaining('DOCTYPE') });
  });

  it('las entidades desconocidas quedan como texto y nunca se resuelven', async () => {
    const { diagram } = await importDrawio(model(box('a', '&desconocida; &#x41; &amp;lt;b&amp;gt;', 0, 0, 'rounded=0;')));
    expect(diagram.elements[0]!.name).toBe('&desconocida; A &lt;b&gt;');
  });

  it('el HTML de las etiquetas es solo texto: con html=1 se quitan las etiquetas y sin él se conserva literal', async () => {
    const hostile = '&lt;img src=x onerror=alert(1)&gt;Hola&lt;script&gt;alert(2)&lt;/script&gt;';
    const { diagram } = await importDrawio(model(box('a', hostile, 0, 0, 'rounded=0;html=1;') + box('b', hostile, 0, 100, 'rounded=0;html=0;')));
    expect(diagram.elements[0]!.name).toBe('Hola' + 'alert(2)');
    expect(diagram.elements[1]!.name).toBe('<img src=x onerror=alert(1)>Hola<script>alert(2)</script>');
  });

  it('no descarga imágenes externas: las omite con aviso', async () => {
    const image = box('i', '', 0, 0, 'shape=image;image=https://ejemplo.test/logo.png;');
    const { diagram, warnings } = await importDrawio(model(box('a', 'Uno', 0, 0) + image));
    expect(diagram.elements).toHaveLength(1);
    expect(warnings).toEqual([expect.stringContaining('URL externas')]);
  });

  it('acota el texto, la descompresión y las celdas', async () => {
    expect(await failure('x'.repeat(MAX_DRAWIO_SOURCE_LENGTH + 1))).toMatchObject({ code: 'LIMIT_EXCEEDED', path: '/source' });
    const bomb = deflateRawSync(Buffer.alloc(40 * 1024 * 1024)).toString('base64');
    expect(await failure(`<mxfile><diagram name="B">${bomb}</diagram></mxfile>`)).toMatchObject({ code: 'LIMIT_EXCEEDED', path: '/source' });
    const many = Array.from({ length: 501 }, (_, i) => box(`n${i}`, `N${i}`, i, 0)).join('');
    expect(await failure(model(many))).toMatchObject({ code: 'LIMIT_EXCEEDED' });
    const deep = '<a>'.repeat(100) + '</a>'.repeat(100);
    expect(await failure(deep)).toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});

describe('importDrawio: errores en el formato común', () => {
  it.each([
    ['vacío', '   ', 'No hay contenido'],
    ['no es XML de draw.io', '<html><body>hola</body></html>', 'mxfile'],
    ['XML mal cerrado', '<mxGraphModel><root></mxGraphModel>', 'XML mal formado'],
    ['atributo sin comillas', '<mxGraphModel a=1/>', 'comillas'],
    ['comprimido dañado', '<mxfile><diagram name="D">AAAABBBBCCCC</diagram></mxfile>', 'descomprimir'],
    ['sin páginas', '<mxfile></mxfile>', 'páginas'],
    ['página vacía', '<mxfile><diagram name="V"></diagram></mxfile>', 'vacía'],
    ['sin elementos', model(''), 'no contiene elementos'],
  ])('%s', async (_nombre, source, fragmento) => {
    expect(await failure(source)).toMatchObject({
      code: 'SCHEMA_VIOLATION',
      path: '/source',
      message: expect.stringContaining(fragmento),
      hint: expect.stringMatching(/\S/),
    });
  });
});
