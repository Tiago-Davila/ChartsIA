---
name: chartsia-proyectos
description: Organiza diagramas de ChartsIA en proyectos con create_project y move_diagram. Úsala solo cuando la persona pide crear un proyecto, agrupar diagramas o moverlos entre proyectos.
metadata:
  herramientas: create_project, move_diagram
---

# Organizar en proyectos

Agrupa diagramas en proyectos de la barra lateral con `create_project` y `move_diagram`.

## Uso

- Úsala solo si la persona pide organizar, agrupar o mover diagramas entre proyectos. Nunca crees proyectos por tu cuenta.
- Para encontrar diagramas y proyectos existentes usa `list_diagrams`, de `chartsia-listar-diagramas`.
- Al crear o importar un diagrama dentro de un proyecto, pasa su `projectId` en esa misma llamada en vez de moverlo después.

## Diseño

- **Un solo proyecto por nombre**: antes de crear, busca uno con ese nombre sin distinguir mayúsculas ni tildes. Si existe, úsalo.
- **Nombre**: corto y del dominio de la persona ("Tienda en línea"), tal como lo dijo.
- **Sacar de un proyecto**: `move_diagram` con `projectId: null`.

## Orden

1. Llama a `list_diagrams` para ver los proyectos y en cuál está cada diagrama.
2. Si el proyecto no existe, créalo con `create_project` y guarda el `projectId`.
3. Llama a `move_diagram` por cada diagrama a mover.
4. Llama a `list_diagrams` de nuevo y confirma a la persona en qué proyecto quedó cada diagrama.

## Revisión

- Si un id no existe, vuelve a listar; no lo adivines.
- Si había dos proyectos con nombres parecidos, pregunta en cuál mover antes de hacerlo.
- Confirma solo lo que muestra el último `list_diagrams`.
