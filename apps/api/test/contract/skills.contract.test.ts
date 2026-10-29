import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMcpHarness, type McpHarness } from '../support/mcp-test-harness.js';

const SKILLS_DIR = new URL('../../../../skills/', import.meta.url);
const SECCIONES = ['Uso', 'Diseño', 'Orden', 'Revisión'];

interface Skill {
  carpeta: string;
  name: string;
  description: string;
  herramientas: string[];
  secciones: string[];
  texto: string;
}

// Lee el frontmatter y las secciones de nivel 2 de cada `skills/<carpeta>/SKILL.md`.
function leerSkills(): Skill[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map(({ name: carpeta }) => {
      const texto = readFileSync(new URL(`${carpeta}/SKILL.md`, SKILLS_DIR), 'utf8');
      const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(texto)?.[1] ?? '';
      const campo = (clave: string) => new RegExp(`^\\s*${clave}:\\s*(.+)$`, 'm').exec(frontmatter)?.[1]?.trim() ?? '';
      return {
        carpeta,
        name: campo('name'),
        description: campo('description'),
        herramientas: campo('herramientas').split(',').map((h) => h.trim()).filter(Boolean),
        secciones: [...texto.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.trim()),
        texto,
      };
    });
}

describe('contract: skills de ChartsIA', () => {
  let h: McpHarness;
  let herramientas: string[];
  const skills = leerSkills();
  beforeAll(async () => {
    h = await createMcpHarness();
    herramientas = (await h.client.listTools()).tools.map((t) => t.name);
  });
  afterAll(() => h.close());

  it.each(skills.map((s) => [s.carpeta, s] as const))('%s tiene nombre, descripción y las cuatro secciones', (carpeta, skill) => {
    expect(skill.name).toBe(carpeta);
    expect(skill.name).toMatch(/^chartsia-[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(skill.description.length).toBeGreaterThan(40);
    expect(skill.description.length).toBeLessThanOrEqual(1024);
    expect(skill.secciones).toEqual(SECCIONES);
  });

  it.each(skills.map((s) => [s.carpeta, s] as const))('%s nombra herramientas MCP que existen', (_carpeta, skill) => {
    expect(skill.herramientas.length).toBeGreaterThan(0);
    for (const herramienta of skill.herramientas) {
      expect(herramientas, `la herramienta ${herramienta} no existe en el hub`).toContain(herramienta);
      expect(skill.texto).toContain(`\`${herramienta}\``);
    }
  });

  it('cada herramienta MCP tiene al menos una skill', () => {
    const cubiertas = new Set(skills.flatMap((s) => s.herramientas));
    const sinSkill = herramientas.filter((h) => !cubiertas.has(h));
    expect(sinSkill, 'agrega una skill en skills/ siguiendo skills/README.md').toEqual([]);
  });

  it('el README de skills lista cada skill', () => {
    const readme = readFileSync(new URL('README.md', SKILLS_DIR), 'utf8');
    for (const skill of skills) expect(readme).toContain(`\`${skill.name}\``);
  });
});
