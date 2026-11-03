---
name: chartsia-hub
description: Lee la configuración del hub de ChartsIA con get_hub_config (carpeta de datos, máximo de elementos por diagrama y acceso desde la red). Úsala antes de crear un diagrama muy grande o cuando la persona pregunta dónde se guardan sus diagramas.
metadata:
  herramientas: get_hub_config
---

# Configuración del hub

Consulta cómo está configurado el hub de la persona con `get_hub_config`; es de solo lectura.

## Uso

- Úsala antes de crear un diagrama con muchos elementos, para no pasar el máximo (`maxElements`).
- Úsala si la persona pregunta dónde se guardan sus diagramas (`dataDir`) o si el hub acepta conexiones de la red.
- No cambia nada. Para cambiar la carpeta de datos, el máximo, el acceso desde la red o el token, dile a la persona que lo haga en la app, en Configuración > Hub y datos. Nunca pidas ni muestres el token.
- El respaldo de los diagramas también se exporta e importa desde esa sección de la app.

## Diseño

- **Máximo de elementos**: cuenta los elementos del diagrama que piensas crear. Si no caben, divide el tema en varios diagramas con `chartsia-crear-diagrama`.
- **Reinicio**: si `restartRequired` es `true`, la persona guardó cambios que el hub todavía no usa. `dataDir` y `network` son lo que el hub usa ahora, no lo guardado.

## Orden

1. Llama a `get_hub_config` con `{}`.
2. Compara `maxElements` con el tamaño del diagrama que vas a crear.
3. Responde con los datos que la persona pidió.

## Revisión

- Si `create_diagram` o `apply_changes` fallan con `LIMIT_EXCEEDED`, vuelve a llamar a `get_hub_config` y ajusta el diagrama al máximo.
- Cuéntale a la persona solo lo que preguntó; la carpeta de datos es una ruta de su equipo.
