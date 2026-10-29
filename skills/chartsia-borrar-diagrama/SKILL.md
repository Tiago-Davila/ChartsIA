---
name: chartsia-borrar-diagrama
description: Borra de forma definitiva un diagrama de ChartsIA con la herramienta delete_diagram, después de confirmarlo con la persona. Úsala solo cuando la persona pide eliminar un diagrama.
metadata:
  herramientas: delete_diagram
---

# Borrar un diagrama

Elimina un diagrama con `delete_diagram`, que no se puede deshacer.

## Uso

- Úsala solo si la persona pide eliminar un diagrama.
- Para quitar elementos de un diagrama usa `chartsia-editar-diagrama`. Para volver atrás un cambio, `chartsia-deshacer`.

## Diseño

- **Es definitivo**: el diagrama y su historia de deshacer desaparecen; `undo_changes` no lo recupera.
- **Nunca para reemplazar**: si la persona quiere "rehacer" un diagrama, crea uno nuevo o edita el existente.
- **Varios diagramas**: identifica cada uno por su título y pide confirmación de la lista completa.

## Orden

1. Llama a `list_diagrams` e identifica el diagrama por título y proyecto.
2. Confirma con la persona nombrando el título y avisando que no se puede deshacer. Si dudas de cuál es, pregunta.
3. Con la confirmación, llama a `delete_diagram` con su `diagramId`.
4. Llama a `list_diagrams` y confirma que ya no está.

## Revisión

- Si la persona no confirmó de forma explícita, no borres.
- Si el id no existe, vuelve a listar; puede que ya se haya borrado.
