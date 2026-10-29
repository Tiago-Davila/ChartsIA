---
name: chartsia-deshacer
description: Deshace o rehace el último cambio de un diagrama de ChartsIA con la herramienta undo_changes. Úsala cuando la persona pide volver atrás, recuperar algo borrado o rehacer lo deshecho.
metadata:
  herramientas: undo_changes
---

# Deshacer y rehacer

Vuelve atrás (o adelante) cambios completos de un diagrama con `undo_changes`.

## Uso

- Úsala cuando la persona pide volver atrás, recuperar elementos borrados o rehacer algo que deshizo.
- No sirve para un diagrama borrado con `delete_diagram`: ese borrado es definitivo.
- No rearmes a mano el estado anterior con `chartsia-editar-diagrama`: deshacer recupera exactamente lo que había.

## Diseño

- **Un paso es un cambio completo**: todo un lote de `apply_changes` o una edición de la persona en la app. Un lote tuyo de diez operaciones se deshace con un solo paso.
- **Pasos**: si la persona pide volver varios cambios, son varias llamadas, una por paso.
- **Historia**: tiene hasta 50 pasos y se pierde si el hub se reinicia.
- **Origen**: el último cambio puede ser de la persona en la app, no tuyo.
- **Dirección**: `direction: "undo"` deshace y `direction: "redo"` rehace.

## Orden

1. Identifica el diagrama: el activo o el que nombra la persona (con `chartsia-listar-diagramas` si hace falta).
2. Confirma con la persona qué se va a deshacer: "el último cambio, que fue …". Si no sabes cuál fue, lee el diagrama y descríbelo.
3. Llama a `undo_changes` una vez por cada paso confirmado.
4. Cuenta el resultado y en qué revisión quedó el diagrama.

## Revisión

- Si el cambio deshecho no era el esperado (por ejemplo, la persona había editado a mano después), dilo y ofrece rehacerlo con `direction: "redo"`.
- Si no hay nada que deshacer, explica que la historia está vacía o se perdió al reiniciar el hub.
- Ante la duda, lee el diagrama después de deshacer y confirma que volvió lo que la persona quería recuperar.
