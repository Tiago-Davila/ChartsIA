import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness, minimalClass } from '../support/mcp-test-harness.js';

describe('contract: proyectos', () => {
  let h: McpHarness;
  beforeEach(async () => {
    h = await createMcpHarness();
  });
  afterEach(() => h.close());

  const newProject = async (name = 'Tienda') => (await h.call('create_project', { name })).structuredContent!.projectId as string;
  const firstDiagram = async () => ((await h.call('list_diagrams')).structuredContent!.diagrams as { projectId?: string }[])[0]!;

  it('create_project devuelve el id, recorta el nombre y emite projects.changed', async () => {
    const res = await h.call('create_project', { name: '  <b>Tienda</b>  ' });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toEqual({ projectId: expect.stringMatching(/^pr_[a-z2-7]{12}$/), name: '<b>Tienda</b>' });
    expect(h.emitted.at(-1)).toMatchObject({ name: 'projects.changed', payload: { projects: [{ name: '<b>Tienda</b>' }] } });
  });

  it('create_project rechaza nombre vacío o demasiado largo', async () => {
    expect(h.errorCodes(await h.call('create_project', { name: '   ' }))).toEqual(['SCHEMA_VIOLATION']);
    expect(h.errorCodes(await h.call('create_project', { name: 'x'.repeat(101) }))).toEqual(['SCHEMA_VIOLATION']);
  });

  it('create_diagram con projectId lo coloca en el proyecto; list_diagrams lo muestra', async () => {
    const projectId = await newProject();
    const created = await h.call('create_diagram', { ...minimalClass, projectId });
    expect(created.isError).toBeFalsy();
    const list = (await h.call('list_diagrams')).structuredContent!;
    expect(list.projects).toEqual([expect.objectContaining({ id: projectId, name: 'Tienda' })]);
    expect(list.diagrams).toEqual([expect.objectContaining({ diagramId: created.structuredContent!.diagramId, projectId })]);
  });

  it('create_diagram con proyecto inexistente ⇒ PROJECT_NOT_FOUND y no crea nada', async () => {
    expect(h.errorCodes(await h.call('create_diagram', { ...minimalClass, projectId: 'pr_zzzzzzzzzzzz' }))).toEqual(['PROJECT_NOT_FOUND']);
    expect((await h.call('list_diagrams')).structuredContent!.diagrams).toEqual([]);
  });

  it('move_diagram mueve y saca con null', async () => {
    const projectId = await newProject();
    const diagramId = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId as string;
    h.emitted.length = 0;
    const moved = await h.call('move_diagram', { diagramId, projectId });
    expect(moved.structuredContent).toEqual({ diagramId, projectId });
    expect(h.emitted.map((e) => e.name)).toEqual(['projects.changed']);
    expect((await firstDiagram()).projectId).toBe(projectId);
    await h.call('move_diagram', { diagramId, projectId: null });
    expect((await firstDiagram()).projectId).toBeUndefined();
  });

  it('move_diagram valida diagrama, proyecto y forma de la entrada', async () => {
    const projectId = await newProject();
    const diagramId = (await h.call('create_diagram', minimalClass)).structuredContent!.diagramId as string;
    expect(h.errorCodes(await h.call('move_diagram', { diagramId: 'dg_zzzzzzzzzzzz', projectId }))).toEqual(['DIAGRAM_NOT_FOUND']);
    expect(h.errorCodes(await h.call('move_diagram', { diagramId, projectId: 'pr_zzzzzzzzzzzz' }))).toEqual(['PROJECT_NOT_FOUND']);
    expect(h.errorCodes(await h.call('move_diagram', { diagramId, projectId: '../../etc' }))).toEqual(['PROJECT_NOT_FOUND']);
    expect(h.errorCodes(await h.call('move_diagram', { diagramId }))).toEqual(['SCHEMA_VIOLATION']);
  });
});
