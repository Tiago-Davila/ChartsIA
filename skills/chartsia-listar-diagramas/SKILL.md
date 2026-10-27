---
name: chartsia-listar-diagramas
description: Lista los diagramas y proyectos de ChartsIA con list_diagrams y abre uno en la app con open_diagram. Úsala cuando la persona se refiere a un diagrama anterior por su nombre o pregunta qué diagramas tiene.
metadata:
  herramientas: list_diagrams, open_diagram
---

# Listar y abrir diagramas

Encuentra el diagrama del que habla la persona con `list_diagrams` y lo abre con `open_diagram`.

## Uso

- Úsala cuando la persona nombra un diagrama anterior ("el de pagos"), pregunta qué diagramas tiene o no está claro sobre cuál trabajar.
- Abrir un diagrama lo vuelve el activo: las llamadas siguientes sin `diagramId` trabajan sobre él.

## Diseño

- **Buscar**:
  - Compara el título sin distinguir mayúsculas ni tildes, y acepta coincidencias parciales.
  - Si la persona nombra un proyecto, busca su id en `projects` y filtra por `projectId`.
- **Mostrar la lista**: corta, del más reciente al más antiguo, agrupada por proyecto. Marca el activo. Muestra título y tipo; los ids solo si la persona los necesita.
- **Varios candidatos**: no elijas por tu cuenta. Muestra las opciones y pregunta.

## Orden

1. Llama a `list_diagrams`.
2. Busca el diagrama por título y proyecto.
3. Uno solo: llama a `open_diagram` con su `diagramId`. Varios: pregunta cuál. Ninguno: dilo y ofrece crearlo con `chartsia-crear-diagrama`.
4. Confirma con el título y el enlace `viewUrl` del diagrama abierto.

## Revisión

- Si `open_diagram` falla por el id, vuelve a listar: el diagrama pudo haberse borrado o movido.
- Si la persona pidió solo ver la lista, no abras ninguno.
