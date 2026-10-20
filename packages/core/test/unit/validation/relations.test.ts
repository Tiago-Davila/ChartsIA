import { describe, expect, it } from 'vitest';
import type { DiagramInput } from '../../../src/model/index.js';
import { validateDiagram } from '../../../src/validation/index.js';
import { c4ContainerDiagram, classDiagram, codes } from '../../support/fixtures.js';

function withRelation(base: DiagramInput, relation: Record<string, unknown>) {
  return validateDiagram({ ...base, relations: [{ id: 'rx', ...relation }] } as DiagramInput);
}

function errorAt(res: ReturnType<typeof validateDiagram>, code: string) {
  return res.ok ? undefined : res.errors.find((e) => e.code === code);
}

const classes = () => {
  const d = classDiagram();
  d.elements.push(
    { id: 'Socio', kind: 'class', name: 'Socio', attributes: [], operations: [] },
    { id: 'Consultable', kind: 'interface', name: 'Consultable', operations: [] },
    { id: 'pkg', kind: 'package', name: 'dominio' },
  );
  return d;
};

describe('RELATION_NOT_ALLOWED', () => {
  it.each([
    ['inheritance', 'Socio', 'Autor', true],
    ['inheritance', 'Prestable', 'Consultable', true],
    ['inheritance', 'Socio', 'Prestable', false],
    ['inheritance', 'Prestable', 'Socio', false],
    ['inheritance', 'Estado', 'Socio', false],
    ['realization', 'Socio', 'Prestable', true],
    ['realization', 'Socio', 'Autor', false],
    ['realization', 'Prestable', 'Consultable', false],
    ['association', 'Socio', 'Estado', true],
    ['dependency', 'Prestable', 'Estado', true],
  ])('%s %s→%s ⇒ permitido=%s', (kind, source, target, ok) => {
    const res = withRelation(classes(), { kind, source, target });
    if (ok) expect(res.ok ? [] : codes(res.errors)).not.toContain('RELATION_NOT_ALLOWED');
    else expect(errorAt(res, 'RELATION_NOT_ALLOWED')?.path).toBe('/relations/0/kind');
  });

  it('prohíbe relaciones hacia o desde grupos', () => {
    const res = withRelation(classes(), { kind: 'dependency', source: 'Socio', target: 'pkg' });
    expect(errorAt(res, 'RELATION_NOT_ALLOWED')).toBeDefined();
    const c4 = withRelation(c4ContainerDiagram(), { kind: 'c4-rel', source: 'tienda', target: 'db' });
    expect(errorAt(c4, 'RELATION_NOT_ALLOWED')).toBeDefined();
  });

  it('prohíbe relaciones UML en C4', () => {
    const res = withRelation(c4ContainerDiagram(), { kind: 'association', source: 'web', target: 'db' });
    expect(errorAt(res, 'RELATION_NOT_ALLOWED')).toBeDefined();
  });

  it('prohíbe c4-rel en diagramas de clases', () => {
    const res = withRelation(classes(), { kind: 'c4-rel', source: 'Socio', target: 'Autor' });
    expect(errorAt(res, 'RELATION_NOT_ALLOWED')).toBeDefined();
  });
});

describe('FIELD_NOT_ALLOWED', () => {
  it.each(['association', 'aggregation', 'composition'])('multiplicidad permitida en %s', (kind) => {
    const res = withRelation(classes(), { kind, source: 'Socio', target: 'Autor', sourceMultiplicity: '1', targetMultiplicity: '*' });
    expect(res.ok).toBe(true);
  });

  it.each(['inheritance', 'realization', 'dependency'])('multiplicidad prohibida en %s', (kind) => {
    const target = kind === 'realization' ? 'Prestable' : 'Autor';
    const res = withRelation(classes(), { kind, source: 'Socio', target, targetMultiplicity: '1' });
    expect(errorAt(res, 'FIELD_NOT_ALLOWED')?.path).toBe('/relations/0/targetMultiplicity');
  });

  it('navigable solo en association', () => {
    expect(withRelation(classes(), { kind: 'association', source: 'Socio', target: 'Autor', navigable: 'both' }).ok).toBe(true);
    const res = withRelation(classes(), { kind: 'composition', source: 'Socio', target: 'Autor', navigable: 'both' });
    expect(errorAt(res, 'FIELD_NOT_ALLOWED')?.path).toBe('/relations/0/navigable');
  });

  it('technology solo en c4-rel', () => {
    expect(withRelation(c4ContainerDiagram(), { kind: 'c4-rel', source: 'web', target: 'db', technology: 'SQL' }).ok).toBe(true);
    const res = withRelation(classes(), { kind: 'dependency', source: 'Socio', target: 'Autor', technology: 'HTTP' });
    expect(errorAt(res, 'FIELD_NOT_ALLOWED')?.path).toBe('/relations/0/technology');
  });
});
