import { isDomainValidationError, type ValidationError } from '@chartsia/core/validation';
import { describe, expect, it } from 'vitest';
import { createServices, libraryInput } from '../support/services.js';

async function domainErrors(promise: Promise<unknown>): Promise<ValidationError[]> {
  try {
    await promise;
  } catch (error) {
    if (isDomainValidationError(error)) return error.errors;
    throw error;
  }
  throw new Error('se esperaba un error de dominio');
}

describe('DiagramCommandService.create', () => {
  it('valida → layout → persiste → emite diagram.created y active.changed', async () => {
    const { commands, repo, emitted } = createServices();
    const { diagram, warnings } = await commands.create(libraryInput);
    expect(warnings).toEqual([]);
    expect(diagram).toMatchObject({ id: 'dg_aaaaaaaaaaaa', revision: 1, title: 'Biblioteca' });
    expect(diagram.elements.every((e) => e.layout?.width)).toBe(true);
    expect(diagram.relations[0]?.route?.length).toBeGreaterThanOrEqual(2);
    expect(await repo.get(diagram.id)).toEqual(diagram);
    expect(await repo.getActiveId()).toBe(diagram.id);
    expect(emitted.map((e) => e.name)).toEqual(['diagram.created', 'active.changed']);
    expect(emitted[0]).toMatchObject({ payload: { diagramId: diagram.id, title: 'Biblioteca', type: 'class' } });
  });

  it('un error de validación no persiste ni emite', async () => {
    const { commands, repo, emitted } = createServices();
    const bad = { ...libraryInput, relations: [{ id: 'r1', kind: 'association', source: 'Libro', target: 'Nadie' }] };
    const errors = await domainErrors(commands.create(bad));
    expect(errors.map((e) => e.code)).toEqual(['UNKNOWN_REFERENCE']);
    expect(await repo.list()).toEqual([]);
    expect(emitted).toEqual([]);
  });

  it('aplica el máximo de elementos configurado', async () => {
    const { commands } = createServices({ maxElements: 1 });
    const errors = await domainErrors(commands.create(libraryInput));
    expect(errors.map((e) => e.code)).toEqual(['LIMIT_EXCEEDED']);
  });
});

describe('DiagramCommandService.apply', () => {
  it('incrementa revision, persiste y emite diagram.updated con el origen', async () => {
    const { commands, repo, emitted } = createServices();
    const { diagram } = await commands.create(libraryInput);
    emitted.length = 0;
    const res = await commands.apply({
      diagramId: diagram.id,
      baseRevision: 1,
      operations: [{ op: 'set_title', title: 'Nueva' }],
      origin: 'app',
    });
    expect(res).toMatchObject({ applied: 1, warnings: [] });
    expect(res.diagram.revision).toBe(2);
    expect((await repo.get(diagram.id))?.title).toBe('Nueva');
    expect(emitted).toEqual([
      { name: 'diagram.updated', payload: { diagramId: diagram.id, revision: 2, origin: 'app', diagram: res.diagram } },
    ]);
  });

  it('diagramId omitido ⇒ usa el diagrama activo', async () => {
    const { commands } = createServices();
    await commands.create(libraryInput);
    const second = await commands.create({ ...libraryInput, title: 'Segundo' });
    const res = await commands.apply({ operations: [{ op: 'set_title', title: 'Renombrado' }], origin: 'agent' });
    expect(res.diagram.id).toBe(second.diagram.id);
  });

  it('sin diagrama activo ⇒ NO_ACTIVE_DIAGRAM', async () => {
    const { commands } = createServices();
    const errors = await domainErrors(commands.apply({ operations: [{ op: 'set_title', title: 'x' }], origin: 'agent' }));
    expect(errors[0]).toMatchObject({ code: 'NO_ACTIVE_DIAGRAM', path: '/diagramId' });
  });

  it('diagramId inexistente ⇒ DIAGRAM_NOT_FOUND', async () => {
    const { commands } = createServices();
    const errors = await domainErrors(
      commands.apply({ diagramId: 'dg_zzzzzzzzzzzz', operations: [{ op: 'set_title', title: 'x' }], origin: 'agent' }),
    );
    expect(errors[0]).toMatchObject({ code: 'DIAGRAM_NOT_FOUND', path: '/diagramId' });
  });

  it('baseRevision distinta ⇒ se aplica igual con warning', async () => {
    const { commands } = createServices();
    const { diagram } = await commands.create(libraryInput);
    const res = await commands.apply({ diagramId: diagram.id, baseRevision: 0, operations: [{ op: 'set_title', title: 'x' }], origin: 'agent' });
    expect(res.diagram.revision).toBe(2);
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toMatch(/revision/);
  });

  it('error de validación: no persiste, no emite, no cambia revision', async () => {
    const { commands, repo, emitted } = createServices();
    const { diagram } = await commands.create(libraryInput);
    emitted.length = 0;
    const errors = await domainErrors(
      commands.apply({ diagramId: diagram.id, operations: [{ op: 'remove_relation', id: 'nope' }], origin: 'agent' }),
    );
    expect(errors[0]?.code).toBe('UNKNOWN_REFERENCE');
    expect((await repo.get(diagram.id))?.revision).toBe(1);
    expect(emitted).toEqual([]);
  });

  it('usa el lock: lotes concurrentes se aplican en serie sin perder cambios', async () => {
    const { commands, repo } = createServices();
    const { diagram } = await commands.create(libraryInput);
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        commands.apply({
          diagramId: diagram.id,
          operations: [{ op: 'add_element', element: { id: `N${i}`, kind: 'class', name: `N${i}`, attributes: [], operations: [] } }],
          origin: 'agent',
        }),
      ),
    );
    const final = await repo.get(diagram.id);
    expect(final?.revision).toBe(6);
    expect(final?.elements.map((e) => e.id)).toEqual(expect.arrayContaining(['N0', 'N1', 'N2', 'N3', 'N4']));
  });
});

describe('DiagramCommandService.undo', () => {
  it('deshace y rehace cambios del agente y de la app, con revision nueva y evento', async () => {
    const { commands, repo, emitted } = createServices();
    const { diagram: created } = await commands.create(libraryInput);
    await commands.apply({ operations: [{ op: 'remove_element', id: 'Libro' }], origin: 'app' });
    await commands.apply({ operations: [{ op: 'set_title', title: 'Otra' }], origin: 'agent' });
    emitted.length = 0;

    await commands.undo({ direction: 'undo', origin: 'app' });
    const undone = await commands.undo({ direction: 'undo', origin: 'app' });
    expect(undone.revision).toBe(5);
    expect(undone.elements).toEqual(created.elements);
    expect(undone.title).toBe('Biblioteca');
    expect(emitted.map((e) => e.name)).toEqual(['diagram.updated', 'diagram.updated']);

    const redone = await commands.undo({ direction: 'redo', origin: 'agent' });
    expect(redone.elements.map((e) => e.id)).toEqual(['Autor']);
    expect(await repo.get(created.id)).toEqual(redone);
  });

  it('un cambio nuevo descarta lo que se podía rehacer; sin historia ⇒ NOTHING_TO_UNDO', async () => {
    const { commands } = createServices();
    await commands.create(libraryInput);
    expect((await domainErrors(commands.undo({ direction: 'undo', origin: 'app' })))[0]?.code).toBe('NOTHING_TO_UNDO');
    await commands.apply({ operations: [{ op: 'set_title', title: 'A' }], origin: 'app' });
    await commands.undo({ direction: 'undo', origin: 'app' });
    await commands.apply({ operations: [{ op: 'set_title', title: 'B' }], origin: 'app' });
    expect((await domainErrors(commands.undo({ direction: 'redo', origin: 'app' })))[0]?.code).toBe('NOTHING_TO_UNDO');
  });
});

describe('DiagramCommandService.activate', () => {
  it('cambia el activo y emite active.changed', async () => {
    const { commands, repo, emitted } = createServices();
    const first = await commands.create(libraryInput);
    await commands.create({ ...libraryInput, title: 'Segundo' });
    emitted.length = 0;
    await commands.activate(first.diagram.id);
    expect(await repo.getActiveId()).toBe(first.diagram.id);
    expect(emitted).toEqual([{ name: 'active.changed', payload: { diagramId: first.diagram.id } }]);
  });

  it('id inexistente ⇒ DIAGRAM_NOT_FOUND', async () => {
    const { commands } = createServices();
    const errors = await domainErrors(commands.activate('dg_zzzzzzzzzzzz'));
    expect(errors[0]?.code).toBe('DIAGRAM_NOT_FOUND');
  });
});

describe('DiagramCommandService.deleteDiagram', () => {
  it('quita el diagrama, su historial y emite diagram.deleted', async () => {
    const { commands, repo, emitted } = createServices();
    const { diagram } = await commands.create(libraryInput);
    await commands.apply({ diagramId: diagram.id, operations: [{ op: 'set_title', title: 'A' }], origin: 'app' });
    emitted.length = 0;
    await commands.deleteDiagram(diagram.id);
    expect(await repo.get(diagram.id)).toBeUndefined();
    expect(await repo.list()).toEqual([]);
    expect(emitted).toEqual([{ name: 'diagram.deleted', payload: { diagramId: diagram.id } }]);
    expect((await domainErrors(commands.undo({ diagramId: diagram.id, direction: 'undo', origin: 'app' })))[0]?.code).toBe('DIAGRAM_NOT_FOUND');
  });

  it('borrar el activo deja el activo vacío; borrar otro lo conserva', async () => {
    const { commands, repo } = createServices();
    const first = await commands.create(libraryInput);
    const second = await commands.create({ ...libraryInput, title: 'Segundo' });
    await commands.deleteDiagram(first.diagram.id);
    expect(await repo.getActiveId()).toBe(second.diagram.id);
    await commands.deleteDiagram(second.diagram.id);
    expect(await repo.getActiveId()).toBeNull();
  });

  it('id inexistente ⇒ DIAGRAM_NOT_FOUND y no emite', async () => {
    const { commands, emitted } = createServices();
    const errors = await domainErrors(commands.deleteDiagram('dg_zzzzzzzzzzzz'));
    expect(errors[0]?.code).toBe('DIAGRAM_NOT_FOUND');
    expect(emitted).toEqual([]);
  });
});
