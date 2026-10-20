# Third-party notices

ChartsIA reutiliza ideas, notación y recursos de los siguientes proyectos. Las formas se
reimplementan como geometría declarativa propia; no se copia código fuente salvo donde se indica.

| Proyecto | Licencia | Uso |
|----------|----------|-----|
| [draw.io / jgraph](https://github.com/jgraph/drawio) | Apache-2.0 | Notación de formas UML (`mxUML25`) y C4 (`mxC4`); formato de exportación `mxGraphModel` |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | MIT | Formato de exportación `.excalidraw`; estilo boceto |
| [roughjs](https://github.com/rough-stuff/rough) | MIT | Render del estilo boceto (dependencia) |
| [elkjs](https://github.com/kieler/elkjs) | EPL-2.0 | Layout automático (dependencia, sin modificar) |
| [Excalifont](https://github.com/excalidraw/excalidraw/tree/master/packages/excalidraw/fonts) | SIL OFL-1.1 | Fuente del estilo boceto, empaquetada sin modificar |
| [Inter](https://github.com/rsms/inter) | SIL OFL-1.1 | Fuente del estilo limpio, empaquetada sin modificar |

Los textos completos de cada licencia se encuentran en los repositorios enlazados y en
`node_modules/<paquete>/LICENSE` para las dependencias.
