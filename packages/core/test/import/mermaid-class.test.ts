import { describe, expect, it } from 'vitest';
import { importMermaidClassDiagram, MermaidImportError, MAX_MERMAID_ANNOTATIONS, MAX_MERMAID_SOURCE_LENGTH } from '../../src/import/mermaid-class.js';
import { validateDiagram } from '../../src/validation/index.js';

describe('importMermaidClassDiagram', () => {
  it('convierte miembros, genéricos anidados, etiquetas escapadas y tipos con nombre', () => {
    const quote = String.fromCharCode(96);
    const { diagram } = importMermaidClassDiagram([
      'classDiagram',
      'class Square~Shape~ {',
      '  +List~int~ position',
      '  +List~List~int~~ matrix',
      '  +getMatrix() List~List~int~~',
      '  +setPoints(List~int~ points)',
      '}',
      'class ' + quote + 'Animal Class!' + quote,
      'class Car["Car & label"]',
      quote + 'Animal Class!' + quote + ' --> Car : owns',
    ].join('\n'));
    const square = diagram.elements.find((element) => element.name === 'Square<Shape>');
    expect(square?.kind).toBe('class');
    if (square?.kind !== 'class') throw new Error('Square debe ser clase');
    expect(square.attributes.map(({ name, type }) => [name, type])).toEqual([
      ['position', 'List<int>'],
      ['matrix', 'List<List<int>>'],
    ]);
    expect(square.operations[0]?.returnType).toBe('List<List<int>>');
    expect(square.operations[1]?.parameters).toEqual([{ name: 'points', type: 'List<int>' }]);
    expect(diagram.elements.map((element) => element.name)).toContain('Animal Class!');
    expect(diagram.elements.map((element) => element.name)).toContain('Car & label');
    expect(diagram.relations[0]).toMatchObject({ kind: 'association', label: 'owns' });
    expect(validateDiagram(diagram).ok).toBe(true);
  });

  it('importa namespaces explícitos, anidados, con etiquetas y referencias no calificadas', () => {
    const { diagram } = importMermaidClassDiagram([
      'classDiagram',
      'namespace Auth["Authentication Service"] {',
      '  namespace Internal {',
      '    class UserService {',
      '      +login()',
      '    }',
      '  }',
      '}',
      'namespace Company.Engineering {',
      '  class TechLead',
      '}',
      'namespace Company.Engineering.Backend {',
      '  class Developer',
      '}',
      'TechLead --> Developer : leads',
    ].join('\n'));
    const auth = diagram.elements.find((element) => element.name === 'Authentication Service');
    const internal = diagram.elements.find((element) => element.name === 'Internal');
    const userService = diagram.elements.find((element) => element.name === 'UserService');
    expect(internal?.parentId).toBe(auth?.id);
    expect(userService?.parentId).toBe(internal?.id);
    expect(diagram.relations[0]).toMatchObject({ kind: 'association', label: 'leads' });
    expect(validateDiagram(diagram).ok).toBe(true);
  });

  it('mapea relaciones UML canónicas y conserva multiplicidades representables', () => {
    const { diagram } = importMermaidClassDiagram([
      'classDiagram',
      'class Parent',
      'class Child',
      'class Whole',
      'class Part',
      'class User',
      'class Ticket',
      'class Caller',
      'class Dependency',
      'Parent <|-- Child',
      'Whole *-- Part',
      'User "1" --> "1..*" Ticket : owns',
      'Caller "1" ..> "2" Dependency : invokes',
      'class Service',
      '<<interface>> Contract',
      'Service ..|> Contract',
      'class SolidService',
      'Contract <|-- SolidService',
      'class A',
      'class B',
      'A .. B',
    ].join('\n'));
    expect(diagram.relations.map(({ kind }) => kind)).toEqual([
      'inheritance',
      'composition',
      'association',
      'dependency',
      'realization',
      'realization',
      'connector',
    ]);
    expect(diagram.relations[2]).toMatchObject({ sourceMultiplicity: '1', targetMultiplicity: '1..*', navigable: 'source-to-target', label: 'owns' });
    expect(diagram.relations[3]?.label).toContain('multiplicidad izquierda "1"');
    expect(diagram.relations[3]?.label).toContain('multiplicidad derecha "2"');
    expect(diagram.relations[6]).toMatchObject({ dashed: true, arrowheads: 'none' });
    expect(validateDiagram(diagram).ok).toBe(true);
  });

  it('importa enumeraciones, anotaciones y métodos con clasificadores', () => {
    const { diagram } = importMermaidClassDiagram([
      'classDiagram',
      'class Shape {',
      '  <<interface>>',
      '  draw()',
      '}',
      'class AbstractShape <<abstract>>',
      'class Color {',
      '  <<enumeration>>',
      '  RED',
      '  GREEN',
      '}',
      'class Worker {',
      '  +run() bool*',
      '  +create() Worker$',
      '  +String name$',
      '}',
    ].join('\n'));
    expect(diagram.elements.find((element) => element.name === 'Shape')?.kind).toBe('interface');
    expect(diagram.elements.find((element) => element.name === 'AbstractShape')).toMatchObject({ kind: 'class', abstract: true });
    expect(diagram.elements.find((element) => element.name === 'Color')).toMatchObject({ kind: 'enum', literals: ['RED', 'GREEN'] });
    const worker = diagram.elements.find((element) => element.name === 'Worker');
    expect(worker?.kind).toBe('class');
    if (worker?.kind !== 'class') throw new Error('Worker debe ser clase');
    expect(worker.operations).toEqual([
      { name: 'run', parameters: [], returnType: 'bool', visibility: '+', abstract: true },
      { name: 'create', parameters: [], returnType: 'Worker', visibility: '+', static: true },
    ]);
    expect(worker.attributes[0]).toMatchObject({ name: 'name', type: 'String', static: true });
    expect(validateDiagram(diagram).ok).toBe(true);
  });

  it('acota anotaciones por clase y avisa si el modelo no puede conservarlas todas', () => {
    const { diagram, warnings } = importMermaidClassDiagram([
      'classDiagram',
      'class Registro {',
      '  <<entity>>',
      '  <<auditable>>',
      '  <<versioned>>',
      '}',
    ].join('\n'));
    expect(diagram.elements[0]).toMatchObject({ name: 'Registro', stereotype: 'entity' });
    expect(warnings).toEqual([expect.stringContaining('anotaciones que no admite el modelo canónico')]);

    const annotations = Array.from({ length: MAX_MERMAID_ANNOTATIONS + 1 }, (_, index) => '  <<tag' + index + '>>').join('\n');
    expect(() => importMermaidClassDiagram('classDiagram\nclass Registro {\n' + annotations + '\n}')).toThrow(/límite de 8 anotaciones/);
  });

  it('conserva lollipop, relaciones de dos extremos y multiplicidades no representables con warnings', () => {
    const { diagram, warnings } = importMermaidClassDiagram([
      'classDiagram',
      'class Service',
      'Contract ()-- Service',
      'class Animal',
      'class Zebra',
      'Animal "0..*" <|--|> "1" Zebra',
      'Customer "1..n" --> "many" Ticket',
    ].join('\n'));
    expect(diagram.elements.find((element) => element.name === 'Contract')?.kind).toBe('interface');
    expect(diagram.relations[0]).toMatchObject({ kind: 'realization', source: expect.any(String), target: expect.any(String) });
    expect(diagram.relations[1]).toMatchObject({ kind: 'connector', arrowheads: 'both', label: expect.stringContaining('Mermaid: multiplicidad izquierda "0..*"') });
    expect(diagram.relations[1]?.label).toContain('multiplicidad derecha "1"');
    expect(diagram.relations[2]?.label).toContain('1..n');
    expect(diagram.relations[2]?.label).toContain('many');
    expect(warnings.some((warning) => warning.includes('lollipop'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('dos extremos'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('multiplicidad'))).toBe(true);
    expect(validateDiagram(diagram).ok).toBe(true);
  });

  it('omite directivas visuales e interactivas como texto inerte sin importar enlaces ejecutables', () => {
    const { diagram, warnings } = importMermaidClassDiagram([
      'classDiagram',
      'class Safe',
      'click Safe href "javascript:alert(1)" "malicioso"',
      'link Safe "https://example.invalid"',
      'direction RL',
      'style Safe fill:#fff',
    ].join('\n'));
    expect(diagram.elements.map(({ name }) => name)).toContain('Safe');
    expect(JSON.stringify(diagram)).not.toContain('javascript:');
    expect(JSON.stringify(diagram)).not.toContain('example.invalid');
    expect(warnings).toHaveLength(4);
  });

  it('ignora configuración Mermaid incrustada sin evaluar callbacks o referencias externas', () => {
    const { diagram, warnings } = importMermaidClassDiagram([
      '%%{init: { callback: "https://example.invalid/collect" }}%%',
      'classDiagram',
      'class Safe["<img src=x onerror=alert(1)>"]',
    ].join('\n'));
    expect(diagram.elements[0]?.name).toBe('<img src=x onerror=alert(1)>');
    expect(JSON.stringify(diagram)).not.toContain('example.invalid');
    expect(warnings).toEqual([expect.stringContaining('directiva de configuración')]);
  });

  it('rechaza sintaxis inválida con línea y limita tamaño y profundidad de genéricos', () => {
    expect(() => importMermaidClassDiagram('graph TD\nA --> B')).toThrow(MermaidImportError);
    try {
      importMermaidClassDiagram('classDiagram\nclass A\nthis is not Mermaid');
    } catch (error) {
      expect(error).toBeInstanceOf(MermaidImportError);
      expect((error as MermaidImportError).line).toBe(3);
    }
    expect(() => importMermaidClassDiagram('x'.repeat(MAX_MERMAID_SOURCE_LENGTH + 1))).toThrow(/máximo/);
    const tooDeep = 'T' + '~T'.repeat(34) + '~'.repeat(34);
    expect(() => importMermaidClassDiagram('classDiagram\nclass Box {\n  ' + tooDeep + ' value\n}')).toThrow(/profundidad máxima/);
    expect(() => importMermaidClassDiagram('classDiagram\nclass ' + tooDeep)).toThrow(/profundidad máxima/);
    expect(() => importMermaidClassDiagram('classDiagram\nnamespace A["Etiqueta"basura] {\nclass B\n}')).toThrow(/namespace inválido/);
  });
});
