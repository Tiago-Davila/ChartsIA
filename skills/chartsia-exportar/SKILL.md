---
name: chartsia-exportar
description: Exporta un diagrama de ChartsIA a SVG, draw.io o Excalidraw con la herramienta export_diagram y lo entrega como archivo o enlace. Úsala cuando la persona pide una imagen, un archivo o llevar el diagrama a otra herramienta.
metadata:
  herramientas: export_diagram
---

# Exportar un diagrama

Exporta un diagrama con `export_diagram` y lo deja donde la persona lo necesita.

## Uso

- Úsala cuando la persona pide una imagen, un archivo, o seguir el diagrama en draw.io o Excalidraw.
- Si la persona solo quiere verlo, alcanza con el enlace de la app; no hace falta exportar.

## Diseño

- **Formato**: elige según el pedido.
  - `svg`: imagen para documentación, un README o una presentación. Es el formato por defecto si la persona no dice otro; aclara que elegiste SVG.
  - `drawio`: para seguir editando en draw.io (app.diagrams.net).
  - `excalidraw`: para seguir como boceto en excalidraw.com.
- **Destino**: la ruta que dijo la persona. Si no dijo ninguna y puedes escribir archivos, usa el `filename` que devuelve la herramienta en la carpeta de trabajo actual.

## Orden

1. Asegúrate de exportar el diagrama correcto: el activo, o el `diagramId` del que se habla.
2. Llama a `export_diagram` con el `format` elegido.
3. Si la respuesta trae `content` y puedes escribir archivos, guárdalo tal cual en la ruta de destino, con la extensión de `filename`.
4. Si no trae `content` (archivo de más de 512 KiB) o no puedes escribir archivos, entrega el `downloadUrl`.
5. Di la ruta exacta del archivo guardado o el enlace de descarga.

## Revisión

- No modifiques `content` antes de guardarlo; se abre tal cual en el programa de destino.
- La extensión del archivo guardado debe coincidir con el formato (`.svg`, `.drawio`, `.excalidraw`).
- No digas que guardaste un archivo si no pudiste escribirlo; en ese caso da el `downloadUrl`.
