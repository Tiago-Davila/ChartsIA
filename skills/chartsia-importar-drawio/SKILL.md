---
name: chartsia-importar-drawio
description: Importa un diagrama de draw.io (archivo .drawio o XML copiado) a un diagrama nuevo de ChartsIA con la herramienta import_drawio. Úsala cuando la persona trae un diagrama hecho en draw.io o app.diagrams.net.
metadata:
  herramientas: import_drawio
---

# Importar draw.io

Convierte un `.drawio` o lo copiado en draw.io en un diagrama nuevo con `import_drawio`.

## Uso

- Úsala cuando la persona adjunta un `.drawio` o `.xml`, o pega XML que empieza con `<mxfile` o `<mxGraphModel`, a veces codificado como URL (`%3Cmx…`).
- Si la persona quiere cambios sobre lo importado, primero importa y después usa `chartsia-editar-diagrama`.

## Diseño

- **Texto**: manda el XML completo tal cual. Puede venir comprimido; no lo descomprimas ni lo edites.
- **Varias páginas**: se importa solo la primera. Si la persona quiere otra, pídele que la exporte sola o que la mueva al principio.
- **Título**: usa `title` si la persona lo nombró; si no, el hub toma el nombre de la página.
- **Proyecto**: `projectId` solo si la persona pidió agruparlo.
- **Seguridad**: no agregues contenido remoto. El hub rechaza `DOCTYPE` y entidades.

## Orden

1. Lee el archivo o toma el XML pegado.
2. Llama a `import_drawio` con `source` y, si corresponde, `title` y `projectId`.
3. Si vuelve `isError`, explica el error (ver Revisión).
4. Cuenta qué se importó: título, cantidad de elementos y relaciones y el enlace `viewUrl`.

## Revisión

- Si el XML no es válido, el error trae `code`, `message` y `hint` sobre `/source`. Explícalo; no inventes un XML para reemplazarlo.
- Los `warnings` dicen qué formas o estilos no tienen equivalente y se omitieron, y si había más páginas. Resúmelos agrupando los repetidos.
- Las rutas de las flechas se recalculan; avisa si la persona esperaba los mismos quiebres.
