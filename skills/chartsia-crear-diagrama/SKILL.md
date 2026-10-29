---
name: chartsia-crear-diagrama
description: Crea en ChartsIA un diagrama nuevo de clases UML, C4, entidad-relación o NoSQL con la herramienta create_diagram. Úsala cuando la persona pide un diagrama nuevo o de otro tema, sistema o tipo.
metadata:
  herramientas: create_diagram
---

# Crear un diagrama

Diseña un diagrama nuevo a partir del pedido y créalo en una sola llamada a `create_diagram`.

## Uso

- Úsala cuando la persona pide un diagrama nuevo o distinto de los que ya existen.
- Si quiere cambiar un diagrama que ya existe, usa `chartsia-editar-diagrama`.
- Si trae texto Mermaid, un `.drawio` o un `.excalidraw`, usa la skill de importar de ese formato.
- `create_diagram` nunca toca los diagramas anteriores: cada pedido nuevo es un diagrama aparte.

## Diseño

- **Tipo**: elige según lo que se quiere mostrar y dilo en la respuesta.
  - `class`: estructura de un dominio o de código orientado a objetos.
  - `c4-context`, `c4-container` o `c4-component`: arquitectura, del nivel más alto al más bajo. Un nivel por diagrama.
  - `er`: base relacional. Usa `table` si la persona habla de columnas, claves y FK; usa `entity` y atributos Chen si es un modelo conceptual.
  - `nosql`: colecciones de documentos con campos y subdocumentos.
- **Alcance**: incluye solo lo que la persona pidió o lo que el pedido necesita para entenderse. Si pasa de unos 25 elementos, propone partirlo en varios diagramas.
- **Ids**: estables, legibles y sin tildes ni espacios. Usa el nombre del elemento (`Cliente`, `LineaPedido`) y, para relaciones, origen y destino (`Pedido_Cliente`). Se usan después para editar.
- **Nombres**: en el idioma de la persona, con la convención del tipo (clases en singular, tablas como las nombraría la persona).
- **Relaciones**: usa la relación propia del tipo (`inheritance`, `composition`, `c4-rel` con `label` y `technology`, `er-rel` con sus dos cardinalidades). `connector` solo para figuras o uniones libres.
- **Lo que no se agrega sin pedido**: grupos (`package`, `boundary`, `frame`), salvo que un `component` lo exija; coordenadas, porque el hub dispone el diagrama solo; estilos; proyecto (`projectId`).

## Orden

1. Si el pedido no deja claro el tipo o el alcance, decide con la guía de Diseño. Pregunta solo si dos lecturas darían diagramas muy distintos.
2. Si la persona nombra un proyecto, busca su id con `chartsia-proyectos` antes de crear.
3. Arma todos los elementos y relaciones y mándalos en una sola llamada a `create_diagram`.
4. Si vuelve `isError`, corrige y reenvía el diagrama completo (ver Revisión).
5. Cuenta qué se creó: título, tipo, qué contiene en dos o tres líneas y el enlace `viewUrl`.

## Revisión

- Si algo es inválido no se crea nada. Lee cada error: `path` señala el campo de tu entrada (por ejemplo `/elements/3/kind`) y `hint` dice cómo corregirlo. Corrige eso y reenvía todo; nunca repitas la misma entrada.
- Si el mismo error vuelve dos veces, deja de reintentar y explícale a la persona qué no se puede dibujar.
- Compara la cantidad de elementos y relaciones creados con lo que pensabas mandar.
- Si hay `warnings`, cuéntalos solo cuando cambian algo de lo que la persona pidió.
