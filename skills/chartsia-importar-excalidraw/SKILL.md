---
name: chartsia-importar-excalidraw
description: Importa un dibujo de Excalidraw (archivo .excalidraw o elementos copiados) a un diagrama nuevo de ChartsIA con la herramienta import_excalidraw. Úsala cuando la persona trae un boceto hecho en Excalidraw.
metadata:
  herramientas: import_excalidraw
---

# Importar Excalidraw

Convierte un `.excalidraw` o lo copiado en Excalidraw en un diagrama nuevo con `import_excalidraw`.

## Uso

- Úsala cuando la persona adjunta un `.excalidraw`, o pega JSON con `"type": "excalidraw"` o `"type": "excalidraw/clipboard"`.
- El resultado son figuras, textos, trazos y conectores, no clases ni tablas. Si la persona quiere un diagrama de clases o ER a partir del boceto, ofrece crearlo con `chartsia-crear-diagrama` leyendo el boceto.
- Si la persona quiere cambios sobre lo importado, primero importa y después usa `chartsia-editar-diagrama`.

## Diseño

- **Texto**: manda el JSON completo como texto en `source`, sin recortar ni reformatear.
- **Título**: usa `title` si la persona lo nombró.
- **Proyecto**: `projectId` solo si la persona pidió agruparlo.

## Orden

1. Lee el archivo o toma el JSON pegado.
2. Llama a `import_excalidraw` con `source` y, si corresponde, `title` y `projectId`.
3. Si vuelve `isError`, explica el error (ver Revisión).
4. Cuenta qué se importó: título, cantidad de elementos y relaciones y el enlace `viewUrl`.

## Revisión

- Si el JSON es inválido, el error trae `code`, `path` y `hint`. Explícalo; no reescribas el boceto.
- Los `warnings` dicen qué se omitió: rotación, opacidad, grupos, relleno rayado, tipos sin equivalente y flechas sueltas importadas como trazos. Resúmelos agrupando los repetidos.
