import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

describe('contract: import_mermaid', () => {
  let h: McpHarness;
  beforeEach(async () => { h = await createMcpHarness(); });
  afterEach(() => h.close());

  it('conserva clases, miembros, tipos y relaciones en el diagrama persistido', async () => {
    const res = await h.call('import_mermaid', {
      source: [
        'classDiagram',
        'namespace Ventas {',
        '  class Pedido {',
        '    +List~String~ productos',
        '    +confirmar(fecha: Date) bool',
        '  }',
        '  class Cliente',
        '  Cliente "1" --> "0..*" Pedido : realiza',
        '}',
      ].join('\n'),
    });

    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ revision: 1, counts: { elements: 3, relations: 1 }, warnings: [] });
    const diagram = await h.repo.get(res.structuredContent!.diagramId as string);
    expect(diagram?.elements.find((element) => element.name === 'Pedido')).toMatchObject({
      kind: 'class',
      attributes: [{ name: 'productos', type: 'List<String>' }],
      operations: [{ name: 'confirmar', returnType: 'bool', parameters: [{ name: 'fecha', type: 'Date' }] }],
    });
    expect(diagram?.relations[0]).toMatchObject({ kind: 'association', label: 'realiza', sourceMultiplicity: '1', targetMultiplicity: '0..*' });
    expect(await h.repo.getActiveId()).toBe(diagram?.id);
  });

  it('ignora links interactivos, devuelve un aviso y rechaza sintaxis sin crear diagramas', async () => {
    const safe = await h.call('import_mermaid', {
      source: 'classDiagram\nclass Safe\nclick Safe href "javascript:alert(1)" "malicioso"\nAPI ()-- Safe',
    });
    expect(safe.isError).toBeFalsy();
    expect(safe.structuredContent?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('no se ejecutaron callbacks'),
      expect.stringContaining('lollipop'),
    ]));
    const stored = await h.repo.get(safe.structuredContent!.diagramId as string);
    expect(JSON.stringify(stored)).not.toContain('javascript:');

    const invalid = await h.call('import_mermaid', { source: 'graph TD\nA --> B' });
    expect(h.errorCodes(invalid)).toContain('SCHEMA_VIOLATION');
    expect(invalid.structuredContent?.errors?.[0]).toMatchObject({
      path: '/source',
      message: expect.stringContaining('Línea 1'),
      hint: expect.stringContaining('classDiagram'),
    });
    expect(await h.repo.list()).toHaveLength(1);
  });
});
