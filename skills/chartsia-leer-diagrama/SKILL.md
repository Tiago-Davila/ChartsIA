---
name: chartsia-leer-diagrama
description: Lee un diagrama de ChartsIA con la herramienta get_diagram para conocer sus elementos, relaciones e ids reales. Úsala antes de editar o cuando la persona pregunta qué contiene un diagrama.
metadata:
  herramientas: get_diagram
---

# Leer un diagrama

Trae el estado actual de un diagrama con `get_diagram` y lo resume para la persona o lo usa para editar.

## Uso

- Úsala antes de cualquier edición, para trabajar con los ids reales y no con los que recuerdas.
- Úsala cuando la persona pregunta qué tiene un diagrama o pide revisarlo.
- La lectura incluye lo que la persona cambió a mano en la app, así que vuelve a leer si pasó tiempo desde la última vez.
- Si no se sabe de qué diagrama se habla, primero usa `chartsia-listar-diagramas`.

## Diseño

- **Qué pedir**: sin `diagramId` se lee el diagrama activo. Usa `includeLayout: true` solo si importan las posiciones, por ejemplo para ubicar un elemento al lado de otro.
- **Cómo resumir**:
  - Abre con el título, el tipo y cuántos elementos y relaciones tiene.
  - Agrupa por kind: clases, contenedores, tablas…
  - Nombra las relaciones importantes.
  - Responde lo que la persona preguntó; no vuelques el JSON ni listes todos los ids.
- **Para editar**: guarda los ids exactos, los elementos bloqueados (`locked`) y la `revision`.

## Orden

1. Si hay varios diagramas y no está claro cuál, resuélvelo con `chartsia-listar-diagramas`.
2. Llama a `get_diagram` con el `diagramId`, o sin él para el activo.
3. Si vas a editar, sigue con `chartsia-editar-diagrama` usando esos ids.
4. Si la persona solo preguntaba, responde con el resumen.

## Revisión

- Si el `diagramId` no existe, vuelve a listar los diagramas; no inventes ids.
- El diagrama activo cambia cuando la persona navega en la app. Comprueba que el título leído es el del diagrama del que se habla.
- Si la `revision` cambió entre tu lectura y tu edición, lee otra vez antes de editar.
