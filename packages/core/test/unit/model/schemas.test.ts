import { describe, expect, it } from 'vitest';
import {
  DiagramInputSchema,
  ElementSchema,
  OperationBatchSchema,
  RelationSchema,
} from '../../../src/model/index.js';
import { classDiagram } from '../../support/fixtures.js';

const cls = (extra: Record<string, unknown> = {}) => ({
  id: 'A',
  kind: 'class',
  name: 'A',
  attributes: [],
  operations: [],
  ...extra,
});
const rel = (extra: Record<string, unknown> = {}) => ({
  id: 'r',
  kind: 'association',
  source: 'A',
  target: 'B',
  ...extra,
});

describe('esquemas del modelo', () => {
  it('acepta un diagrama de clases válido', () => {
    expect(DiagramInputSchema.safeParse(classDiagram()).success).toBe(true);
  });

  it.each(['A', 'a1', 'Pedido_Linea-2', 'x'.repeat(64)])('id válido: %s', (id) => {
    expect(ElementSchema.safeParse(cls({ id })).success).toBe(true);
  });

  it.each(['', '1abc', '_a', 'a b', 'a.b', 'x'.repeat(65)])('id inválido: "%s"', (id) => {
    expect(ElementSchema.safeParse(cls({ id })).success).toBe(false);
    expect(RelationSchema.safeParse(rel({ id })).success).toBe(false);
  });

  it('name: 1–200 chars', () => {
    expect(ElementSchema.safeParse(cls({ name: '' })).success).toBe(false);
    expect(ElementSchema.safeParse(cls({ name: 'x'.repeat(200) })).success).toBe(true);
    expect(ElementSchema.safeParse(cls({ name: 'x'.repeat(201) })).success).toBe(false);
  });

  it('description: ≤ 1000 chars', () => {
    expect(ElementSchema.safeParse(cls({ description: 'x'.repeat(1000) })).success).toBe(true);
    expect(ElementSchema.safeParse(cls({ description: 'x'.repeat(1001) })).success).toBe(false);
  });

  it('title: 1–120 chars', () => {
    expect(DiagramInputSchema.safeParse(classDiagram({ title: '' })).success).toBe(false);
    expect(DiagramInputSchema.safeParse(classDiagram({ title: 'x'.repeat(120) })).success).toBe(true);
    expect(DiagramInputSchema.safeParse(classDiagram({ title: 'x'.repeat(121) })).success).toBe(false);
  });

  it('label: ≤ 200', () => {
    expect(RelationSchema.safeParse(rel({ label: 'x'.repeat(200) })).success).toBe(true);
    expect(RelationSchema.safeParse(rel({ label: 'x'.repeat(201) })).success).toBe(false);
  });

  it.each(['1', '*', '0..1', '1..*', '2..5', '*..*'])('multiplicidad válida: %s', (m) => {
    expect(RelationSchema.safeParse(rel({ targetMultiplicity: m })).success).toBe(true);
  });

  it.each(['', 'n', '1..', '..1', '1...2', '-1'])('multiplicidad inválida: "%s"', (m) => {
    expect(RelationSchema.safeParse(rel({ sourceMultiplicity: m })).success).toBe(false);
  });

  it('enum.literals: ≥1 y únicos', () => {
    const en = (literals: string[]) => ({ id: 'E', kind: 'enum', name: 'E', literals });
    expect(ElementSchema.safeParse(en(['A'])).success).toBe(true);
    expect(ElementSchema.safeParse(en([])).success).toBe(false);
    expect(ElementSchema.safeParse(en(['A', 'A'])).success).toBe(false);
  });

  it('enum admite attributes y operations opcionales; method.default es opcional', () => {
    const en = { id: 'E', kind: 'enum', name: 'E', literals: ['A'] };
    expect(ElementSchema.safeParse(en).success).toBe(true);
    const full = { ...en, attributes: [{ name: 'x', visibility: '-' }], operations: [{ name: 'f', parameters: [], visibility: '+' }] };
    expect(ElementSchema.safeParse(full).success).toBe(true);
    const itf = { id: 'I', kind: 'interface', name: 'I', operations: [{ name: 'f', parameters: [], visibility: '+', default: true }] };
    expect(ElementSchema.safeParse(itf).success).toBe(true);
    expect(ElementSchema.safeParse({ ...itf, operations: [{ name: 'f', parameters: [], visibility: '+', default: 'si' }] }).success).toBe(false);
  });

  it('rechaza propiedades adicionales', () => {
    expect(ElementSchema.safeParse(cls({ color: 'red' })).success).toBe(false);
    expect(RelationSchema.safeParse(rel({ style: 'x' })).success).toBe(false);
    expect(DiagramInputSchema.safeParse({ ...classDiagram(), extra: 1 }).success).toBe(false);
  });

  it('acepta coordenadas opcionales del agente en layout', () => {
    expect(ElementSchema.safeParse(cls({ layout: { x: 10, y: 20 } })).success).toBe(true);
    expect(ElementSchema.safeParse(cls({ layout: { x: 10 } })).success).toBe(false);
  });

  it('lote de operaciones: 1–200', () => {
    const op = { op: 'set_title', title: 'T' };
    expect(OperationBatchSchema.safeParse([]).success).toBe(false);
    expect(OperationBatchSchema.safeParse([op]).success).toBe(true);
    expect(OperationBatchSchema.safeParse(Array(200).fill(op)).success).toBe(true);
    expect(OperationBatchSchema.safeParse(Array(201).fill(op)).success).toBe(false);
  });
});
