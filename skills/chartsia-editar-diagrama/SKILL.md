---
name: chartsia-editar-diagrama
description: Edita un diagrama existente de ChartsIA con la herramienta apply_changes, en un solo lote atómico de operaciones. Úsala para agregar, cambiar, mover, borrar o dar estilo a elementos y relaciones de un diagrama que ya existe.
metadata:
  herramientas: apply_changes
---

# Editar un diagrama

Aplica los cambios que pide la persona sobre un diagrama existente con un solo lote de `apply_changes`.

## Uso

- Úsala para refinar el diagrama del que se está hablando.
- Si la persona pide un diagrama nuevo o de otro tema, usa `chartsia-crear-diagrama`: editar el activo lo pisaría.
- Para volver atrás un cambio, usa `chartsia-deshacer`, no operaciones inversas.

## Diseño

- **Qué operación usar**:

| Pedido | Operación |
|---|---|
| Agregar un elemento o una relación | `add_element`, `add_relation` |
| Renombrar o cambiar un campo | `update_element` o `update_relation` con `changes` |
| Cambiar el tipo de flecha o invertirla | `update_relation` con `kind`, o intercambiando `source` y `target` |
| Borrar | `remove_element` (sus relaciones se borran solas) o `remove_relation` |
| Ubicar en un lugar concreto | `move_element` (deja el elemento fijo) |
| Cambiar el tamaño | `resize_element` |
| Traer adelante o mandar atrás | `reorder_element` |
| Colores, grosor o letra | `update_element` o `update_relation` con `style` |
| Cambiar el título | `set_title` |

- **Estilo**: `style` reemplaza el estilo completo; reenvía los campos que hay que conservar.
- **Lo que hizo la persona a mano**:
  - No muevas elementos que no se pidieron; el hub no reubica el resto.
  - No uses `move_element` salvo que la persona pida una posición: deja el elemento fijo.
  - No toques elementos bloqueados (`locked`). Si el pedido los incluye, pregunta antes de desbloquearlos.
- **Alcance**: cambia solo lo pedido. No aproveches para "ordenar" nombres, estilos o grupos.

## Orden

1. Lee el diagrama con `chartsia-leer-diagrama` para tener los ids reales y ver lo editado a mano.
2. Planea todas las operaciones del pedido y ordénalas:
   - los elementos antes que las relaciones que los usan;
   - un marco antes que los elementos con `parentId` hacia él.
3. Manda todo en una sola llamada a `apply_changes`, con el `diagramId` si no es el activo.
4. Si vuelve `isError`, corrige y reenvía el lote completo (ver Revisión).
5. Cuenta en una o dos líneas qué cambió.

## Revisión

- El lote es atómico: si una operación falla, no se aplica ninguna. `path` dice cuál (`/operations/2/id`) y `hint` cómo corregirla. Corrige esa operación y reenvía el lote entero; no partas el lote ni repitas el mismo.
- Si el error es por un id que no existe, vuelve a leer el diagrama: puede que la persona lo haya cambiado.
- Un aviso de `baseRevision` en `warnings` significa que el diagrama cambió desde tu lectura. Lee de nuevo y comprueba que el resultado sigue siendo el pedido.
- Si el lote fue grande, lee el diagrama al final y confirma que todo quedó como se pidió.

## Devolucion
- Devolve lo actualizado. Con atributos, interfaces y relaciones. No hables sobre el MCP.

