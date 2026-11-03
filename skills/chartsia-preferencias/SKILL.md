---
name: chartsia-preferencias
description: Lee y cambia las preferencias de ChartsIA con set_preferences (dirección, espaciado, fuente, colores por tipo, detalle UML, leyenda C4 y exportación). Úsala solo cuando la persona pide cambiar cómo se dibujan o se exportan sus diagramas de ahora en adelante.
metadata:
  herramientas: set_preferences
---

# Preferencias de diagrama y exportación

Guarda cómo se dibujan los diagramas nuevos y cómo se exportan con `set_preferences`.

## Uso

- Úsala solo si la persona pide un cambio general ("siempre de izquierda a derecha", "sin métodos", "más aire entre las clases"). Nunca cambies preferencias por tu cuenta.
- Las de diagrama valen para los diagramas que se creen después y para lo que se agregue a ellos; los diagramas existentes no cambian. Para ajustar uno ya creado usa `apply_changes`, de `chartsia-editar-diagrama`.
- Si la persona pide un diagrama nuevo con una preferencia ("hazlo de izquierda a derecha"), cambia la preferencia y recién después crea el diagrama con `create_diagram`, de `chartsia-crear-diagrama`.

## Diseño

- **Solo lo pedido**: envía únicamente los campos que cambian; los demás se conservan. Con `{}` solo lees las preferencias actuales.
- **Dirección**: `down` apila de arriba a abajo; `right` va de izquierda a derecha y suele servir mejor en diagramas anchos.
- **Espaciado**: `elementSpacing` separa elementos de una misma capa y `layerSpacing` separa las capas. Valores `compact`, `normal` o `wide`.
- **Detalle UML**: `uml.types`, `uml.visibility`, `uml.multiplicities` y `uml.methods` muestran u ocultan cada cosa. Ocultar no borra datos: el diagrama sigue guardando todo.
- **Fuente y colores**: `fontFamily` (o `default`) y `palette` por tipo de elemento, con colores `#rrggbb`. Un tipo en `palette` reemplaza los colores que tenía y `null` se los quita.
- **C4**: `c4Legend` agrega o quita la leyenda automática.
- **Exportación** (campo `export`): `format` por defecto (`svg`, `drawio` o `excalidraw`), `background` (`white` o `transparent`), `margin` en px, `scale` e `includeTitle`. `margin`, `scale` e `includeTitle` solo cambian el SVG; draw.io y Excalidraw tienen lienzo infinito y llevan el título en el archivo. Valen para las exportaciones siguientes, no cambian diagramas.

## Orden

1. Si no sabes qué hay guardado, llama a `set_preferences` con `{}` y lee el resultado.
2. Llama a `set_preferences` con los cambios pedidos.
3. Si la persona quería ver el efecto, crea el diagrama con `create_diagram`.

## Revisión

- Si hay errores, lee `code`, `path` y `hint`, corrige el campo y vuelve a llamar; un valor fuera de lista nunca se corrige adivinando.
- Para exportar una sola vez con otras opciones no cambies la preferencia: pásalas a `export_diagram`, de `chartsia-exportar`.
- Cuéntale a la persona qué quedó guardado según la respuesta, y que los diagramas anteriores siguen igual.
