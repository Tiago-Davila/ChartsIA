# Skills de ChartsIA

Cada skill le enseña a un agente a diseñar con una o más herramientas MCP del hub. Se invoca
como comando (`/chartsia-crear-diagrama`) o el agente la activa sola cuando el pedido coincide
con su descripción. La skill no repite el esquema de la herramienta, que el agente ya recibe en su
descripción: solo explica cómo diseñar, en qué orden llamar, cómo revisar el resultado y cuándo
usarla.

| Skill | Herramientas |
|---|---|
| `chartsia-crear-diagrama` | `create_diagram` |
| `chartsia-leer-diagrama` | `get_diagram` |
| `chartsia-editar-diagrama` | `apply_changes` |
| `chartsia-deshacer` | `undo_changes` |
| `chartsia-exportar` | `export_diagram` |
| `chartsia-importar-mermaid` | `import_mermaid` |
| `chartsia-importar-drawio` | `import_drawio` |
| `chartsia-importar-excalidraw` | `import_excalidraw` |
| `chartsia-listar-diagramas` | `list_diagrams`, `open_diagram` |
| `chartsia-proyectos` | `create_project`, `move_diagram` |
| `chartsia-borrar-diagrama` | `delete_diagram` |

## Instalar y actualizar

Las skills se instalan de forma global, para todos los proyectos, con el CLI
[`skills`](https://github.com/vercel-labs/skills) (Node 22.20 o superior):

```bash
npx skills add Tiago-Davila/ChartsIA -g --skill '*'
```

`--skill '*'` instala todas las skills de esta carpeta; para una sola, se pone su nombre
(`--skill chartsia-crear-diagrama`). El comando pregunta en qué agentes instalarlas (Claude Code,
Codex, Cursor…); con `-a claude-code` se elige uno sin preguntar. Para traer cambios nuevos:

```bash
npx skills update -g
```

Sin el CLI, alcanza con copiar cada carpeta `skills/chartsia-*` a la carpeta de skills del agente,
por ejemplo `~/.claude/skills/` en Claude Code. Las skills necesitan el servidor MCP de ChartsIA
conectado (ver "Conectar agentes" en el README principal).

## Agregar una skill

Toda herramienta MCP nueva necesita una skill: el test
`apps/api/test/contract/skills.contract.test.ts` falla si una herramienta no aparece en ninguna.

1. Si la herramienta encaja en una skill existente (por ejemplo, otra forma de listar), agrégala a
   su `metadata.herramientas` y a sus secciones.
2. Si no, crea `skills/chartsia-<accion>/SKILL.md` copiando la plantilla de abajo. El nombre usa
   el prefijo `chartsia-`, minúsculas y guiones, y coincide con la carpeta.
3. Agrega la fila a la tabla de arriba.
4. Corre `pnpm --filter @chartsia/api exec vitest run test/contract/skills.contract.test.ts`.

Cada `SKILL.md` tiene exactamente estas cuatro secciones, en este orden, y nada más:

- **Uso**: cuándo usar la skill, cuándo no y a qué otra skill derivar.
- **Diseño**: cómo decidir qué mandar para que el resultado sea un buen diagrama.
- **Orden**: los pasos y las llamadas en orden.
- **Revisión**: cómo leer errores, avisos y resultados, y qué contarle a la persona.

### Plantilla

```markdown
---
name: chartsia-<accion>
description: <Qué hace y cuándo usarla, en una o dos oraciones. Es lo que el agente lee para decidir si la activa.>
metadata:
  herramientas: <herramienta_mcp>, <otra_herramienta_mcp>
---

# <Título>

<Una oración: para qué sirve.>

## Uso

## Diseño

## Orden

## Revisión
```
