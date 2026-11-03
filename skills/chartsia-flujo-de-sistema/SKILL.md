---
name: chartsia-flujo-de-sistema
description: Lee el código de un repositorio y dibuja en ChartsIA el flujo de una funcionalidad (un pedido, un login, un webhook) con create_diagram de tipo flow. Úsala cuando la persona pide explicar cómo se procesa algo, qué archivos toca una acción o qué pasa cuando llega un evento.
metadata:
  herramientas: create_diagram, apply_changes
---

# Flujo de sistema

Dibuja cómo se mueve el control y el dato por un código real: primero lees el código, después creas el diagrama `flow` con `create_diagram`.

## Uso

- Úsala cuando la persona pregunta "explícame cómo se procesa un pedido", "qué archivos toca el login" o "qué pasa cuando llega este webhook" y hay código que puedes leer.
- Si pide la estructura de clases o la arquitectura por niveles, usa `chartsia-crear-diagrama` con `class` o `c4-*`.
- Si el flujo ya existe y solo hay que ajustarlo, usa `apply_changes` (ver `chartsia-editar-diagrama`). Nunca armes un flujo nuevo de a poco con `apply_changes` sobre un diagrama vacío: el layout sale menos ordenado.
- Sin acceso al código, no inventes el flujo: pide los archivos o dibuja solo lo que la persona te describe y dilo.

## Diseño

- **Leer antes de dibujar**: parte de un punto de entrada (un endpoint, un handler, un evento, un cron) y síguelo: qué llama, qué importa, qué lee y qué escribe. Anota para cada pieza el archivo y la línea. No dibujes lo que no abriste.
- **Un nodo por pieza relevante**, no por cada línea ni por cada función auxiliar. Si dos funciones seguidas hacen una sola cosa, es un nodo.
- **Variante del nodo** (`variant`):
  - `trigger`: el punto de entrada. Cada flujo empieza en uno.
  - `component`, `method`, `file`: código del repo; `method` para una función puntual, `file` si importa el archivo entero.
  - `service`: un servicio propio o una capa de negocio.
  - `database`, `queue`: donde se guarda o se encola.
  - `decision`: una bifurcación real del código (`if`, validación). Cada salida lleva `label` con la rama ("sí", "no", el caso).
  - `external`: un sistema de terceros fuera del repo.
- **Tipo de conexión** (`flowType` de `flow-edge`): `call` (por defecto) cuando una pieza llama a otra, `import` si solo depende de ella, `read` y `write` para accesos a datos, `event` para lo asíncrono y `data` para un dato o respuesta que pasa de una a otra. Usa `label` para decir qué se llama o qué dato viaja.
- **Subtítulo**: la ruta y la línea donde está la pieza, como `src/orders/service.ts:42`. Para una base de datos, el motor o la tabla.
- **Agrupar**: un `frame` por carpeta, capa o servicio, y `parentId` en los nodos que contiene. Solo si agrupa varios nodos; no pongas un frame por nodo.
- **Alcance**: unos 8 a 20 nodos. Si el flujo es más grande, parte en varios diagramas (por ejemplo, el camino feliz y el manejo de errores).
- **Ids y nombres**: ids estables y sin tildes (`servicio_pedidos`); nombres en el idioma de la persona, tal como se llaman en el código (`OrdersService.create`).
- **Sin coordenadas**: el flujo va siempre de izquierda a derecha y el hub lo ubica solo.

## Orden

1. Ubica el punto de entrada y recorre el código hasta cerrar el flujo, anotando archivo y línea de cada pieza.
2. Decide los nodos, las decisiones y los frames con la guía de Diseño.
3. Manda todo en una sola llamada a `create_diagram`. Ejemplo de entrada:

```json
{
  "type": "flow",
  "title": "Alta de pedido",
  "elements": [
    { "id": "alta", "kind": "flow-node", "variant": "trigger", "name": "POST /orders", "subtitle": "src/orders/controller.ts:18" },
    { "id": "modulo", "kind": "frame", "name": "src/orders" },
    { "id": "servicio", "kind": "flow-node", "variant": "method", "name": "OrdersService.create", "subtitle": "src/orders/service.ts:42", "parentId": "modulo" },
    { "id": "stock", "kind": "flow-node", "variant": "decision", "name": "¿Hay stock?", "subtitle": "src/orders/service.ts:57", "parentId": "modulo" },
    { "id": "repositorio", "kind": "flow-node", "variant": "file", "name": "orders.repository.ts", "subtitle": "src/orders/repository.ts:12", "parentId": "modulo" },
    { "id": "rechazo", "kind": "flow-node", "variant": "method", "name": "OrdersService.reject", "subtitle": "src/orders/service.ts:80", "parentId": "modulo" },
    { "id": "pedidos", "kind": "flow-node", "variant": "database", "name": "orders", "subtitle": "PostgreSQL" },
    { "id": "cola", "kind": "flow-node", "variant": "queue", "name": "orders.created", "subtitle": "src/orders/events.ts:12" },
    { "id": "correo", "kind": "flow-node", "variant": "external", "name": "SendGrid" }
  ],
  "relations": [
    { "id": "alta_servicio", "kind": "flow-edge", "source": "alta", "target": "servicio", "label": "create()" },
    { "id": "servicio_stock", "kind": "flow-edge", "source": "servicio", "target": "stock" },
    { "id": "stock_repositorio", "kind": "flow-edge", "source": "stock", "target": "repositorio", "label": "sí" },
    { "id": "stock_rechazo", "kind": "flow-edge", "source": "stock", "target": "rechazo", "label": "no" },
    { "id": "repositorio_pedidos", "kind": "flow-edge", "source": "repositorio", "target": "pedidos", "flowType": "write", "label": "insert" },
    { "id": "repositorio_cola", "kind": "flow-edge", "source": "repositorio", "target": "cola", "flowType": "event" },
    { "id": "cola_correo", "kind": "flow-edge", "source": "cola", "target": "correo", "flowType": "data", "label": "confirmación" }
  ]
}
```

4. Si vuelve `isError`, corrige y reenvía el flujo completo (ver Revisión).
5. Cuenta el recorrido en pocas líneas, de izquierda a derecha, y el enlace `viewUrl`.
6. Si la persona pide ajustes, usa `apply_changes` con el `diagramId` devuelto: agrega o cambia nodos y conexiones sin mover los demás.

## Revisión

- Si algo es inválido no se crea nada. Lee `code`, `path` y `hint` de cada error y corrige el campo señalado:
  - `/elements/N/variant`: usa una de las variantes de Diseño.
  - `FIELD_REQUIRED` en `/relations/N/label`: una salida de una `decision` no tiene etiqueta.
  - `RELATION_NOT_ALLOWED`: una `flow-edge` solo une `flow-node` o `frame`.
- Si el mismo error vuelve dos veces, deja de reintentar y explícale a la persona qué no se puede dibujar.
- Compara los nodos y conexiones creados (`counts`) con lo que pensabas mandar.
- Revisa que cada subtítulo apunte a un archivo y una línea que existen; no inventes rutas ni líneas.
- Cuéntale a la persona qué piezas del código recorre el flujo y qué dejaste fuera a propósito. No expliques cómo funciona el MCP.
