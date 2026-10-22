import { library } from './support/fake-agent';

const agrupado = {
  type: 'class',
  title: 'Agrupado',
  elements: [
    { id: 'pkg', kind: 'package', name: 'Paquete' },
    { id: 'A', kind: 'class', name: 'A', attributes: [], operations: [], parentId: 'pkg' },
    { id: 'B', kind: 'class', name: 'B', attributes: [], operations: [], parentId: 'pkg' },
    { id: 'C', kind: 'class', name: 'C', attributes: [], operations: [] },
  ],
  relations: [{ id: 'r1', kind: 'association', source: 'A', target: 'C' }],
};
import { expect, test } from './support/fixtures';

for (const [nombre, diagrama] of [
  ['clases', library],
  ['con paquete', agrupado],
] as const) {
  test(`Ajustar deja todo el diagrama a la vista tras un cambio del agente y pan lejos (${nombre})`, async ({
    page,
    agent,
  }) => {
    const id = await agent.create({ ...diagrama, title: 'Ajustar' });
    await page.goto(`/d/${id}`);
    const canvas = page.locator('.react-flow');
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeVisible();

    // Un cambio del agente reemplaza los nodos antes de perderse en el lienzo.
    await agent.apply(
      [
        {
          op: 'add_element',
          element: { id: 'Nuevo', kind: 'class', name: 'Nuevo', attributes: [], operations: [] },
        },
      ],
      id,
    );
    await expect(page.locator('[data-element-id="Nuevo"]')).toBeVisible();

    // Deja un elemento seleccionado, aleja el zoom y arrastra el lienzo hasta perder el diagrama.
    await nodes.first().click({ position: { x: 20, y: 8 } });
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 600);
    await page.keyboard.up('Control');
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.keyboard.down('Space');
    await page.mouse.down();
    await page.mouse.move(box.x + 1500, box.y + 600, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');

    // El primer clic muestra el cambio; el segundo deja todo el diagrama a la vista.
    await page.getByRole('button', { name: 'Ajustar', exact: true }).click();
    await expect(page.locator('[data-element-id="Nuevo"]')).toBeInViewport();
    await page.getByRole('button', { name: 'Ajustar', exact: true }).click();

    // Tras la animación corta, cada nodo está dentro del lienzo.
    await expect
      .poll(async () => {
        const area = (await canvas.boundingBox())!;
        for (const node of await nodes.all()) {
          const b = (await node.boundingBox())!;
          if (
            b.x < area.x ||
            b.y < area.y ||
            b.x + b.width > area.x + area.width ||
            b.y + b.height > area.y + area.height
          )
            return false;
        }
        return true;
      })
      .toBe(true);
  });
}
