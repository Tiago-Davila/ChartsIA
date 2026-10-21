import { isDomainValidationError } from '@chartsia/core/validation';
import { describe, expect, it } from 'vitest';
import { createServices, libraryInput } from '../support/services.js';

describe('DiagramQueryService', () => {
  it('get sin includeLayout omite layout y route', async () => {
    const { commands, query } = createServices();
    const { diagram } = await commands.create(libraryInput);
    const plain = await query.get(diagram.id);
    expect(plain.elements.some((e) => 'layout' in e)).toBe(false);
    expect(plain.relations.some((r) => 'route' in r)).toBe(false);
    const full = await query.get(diagram.id, true);
    expect(full).toEqual(diagram);
  });

  it('get sin id devuelve el activo', async () => {
    const { commands, query } = createServices();
    const { diagram } = await commands.create(libraryInput);
    expect((await query.get()).id).toBe(diagram.id);
  });

  it.each([
    ['DIAGRAM_NOT_FOUND', 'dg_zzzzzzzzzzzz'],
    ['NO_ACTIVE_DIAGRAM', undefined],
  ])('%s', async (code, id) => {
    const { query } = createServices();
    await expect(query.get(id)).rejects.toSatisfy(
      (e: unknown) => isDomainValidationError(e) && e.errors[0]?.code === code,
    );
  });

  it('list devuelve el activo y los resúmenes', async () => {
    const { commands, query } = createServices();
    expect(await query.list()).toEqual({ activeDiagramId: null, diagrams: [], projects: [] });
    const { diagram } = await commands.create(libraryInput);
    expect(await query.list()).toEqual({
      activeDiagramId: diagram.id,
      diagrams: [{ diagramId: diagram.id, type: 'class', title: 'Biblioteca', revision: 1, updatedAt: diagram.updatedAt }],
      projects: [],
    });
  });
});
