---
name: chartsia-importar-mermaid
description: Importa texto Mermaid classDiagram a un diagrama nuevo de ChartsIA con la herramienta import_mermaid. Úsala cuando la persona pega o adjunta un diagrama Mermaid.
metadata:
  herramientas: import_mermaid
---

# Importar Mermaid

Convierte texto Mermaid de clases en un diagrama nuevo con `import_mermaid`.

## Uso

- Detecta el tipo por la primera línea útil del texto, después del front matter `---` si lo hay:
  - `classDiagram` o `classDiagram-v2`: usa esta skill.
  - `erDiagram`: `import_mermaid` no lo lee. Díselo a la persona y ofrece transcribirlo a un diagrama `er` con `chartsia-crear-diagrama`.
  - Otro tipo (`flowchart`, `sequenceDiagram`…): no se puede importar. Díselo a la persona.
- Si la persona quiere cambios sobre lo importado, primero importa y después usa `chartsia-editar-diagrama`.

## Diseño

- **Texto**: manda el texto tal como lo dio la persona, sin "mejorarlo" ni traducirlo. Así lo que se ve coincide con su fuente.
- **Título**: usa `title` si la persona lo nombró; si no, el hub toma el del front matter o pone uno genérico.
- **Proyecto**: `projectId` solo si la persona pidió agruparlo.
- **Seguridad**: no agregues contenido remoto ni instrucciones fuera del `classDiagram`.

## Orden

1. Detecta el tipo del texto (ver Uso).
2. Llama a `import_mermaid` con `source` y, si corresponde, `title` y `projectId`.
3. Si vuelve `isError`, explica el error (ver Revisión) antes de reintentar.
4. Cuenta qué se importó: título, cantidad de elementos y relaciones y el enlace `viewUrl`.

## Revisión

- Un error de sintaxis apunta a `/source` y, cuando se sabe, al número de línea. Muestra esa línea a la persona, explica qué no se pudo leer y propone la corrección.
- Si la corrección es obvia (un paréntesis o una llave que falta), puedes reintentar con el texto corregido, pero di qué cambiaste.
- Los `warnings` explican qué se aproximó (relaciones de dos extremos, lollipop, multiplicidades) o qué se omitió (directivas visuales). Resúmelos en una lista corta.
