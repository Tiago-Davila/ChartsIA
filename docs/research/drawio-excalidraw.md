# Investigación: cómo modelan diagramas draw.io y Excalidraw

Fecha: 2026-10-19. Fuente: clones shallow de `jgraph/drawio` y `excalidraw/excalidraw`,
analizados con REA (`analyze_javascript_application`, Evidence
`ev_ebb185022bb4…` drawio, `ev_bb6a06c6269c…` excalidraw) y lectura directa del código.

## draw.io (mxGraph)

- **Modelo**: grafo de `mxCell` (vértices y aristas) con `id`, `parent`, `source`, `target`,
  `geometry` y un **string de estilo** `clave=valor;` (p. ej. `swimlane;fontStyle=1;`).
  La semántica de la forma (UML, AWS, C4, K8s…) vive en el estilo, no en el tipo.
- **Serialización**: `mxCodec` codifica el `mxGraphModel` a XML (`Editor.getGraphXml`,
  `grapheditor/Editor.js:1611`). Opcionalmente comprimido: `deflateRaw` → base64
  (`Graph.compress`, `grapheditor/Graph.js:3364`). Archivo `.drawio` = `<mxfile><diagram>…`.
- **Librerías de formas**: `shapes/mx*.js` (`mxUML25`, `mxC4`, `mxAWS4`, `mxKubernetes`,
  `mxArchiMate`, `mxSysML`…) + `sidebar/Sidebar-*.js` con plantillas de estilo.
- **Layout automático**: ELK (`js/elk/drawio-elk.min.js`, pipeline mxGraph → ELK JSON →
  layout → mutaciones) y enrutado de aristas con libavoid. Ambos **compartidos con
  `drawio-mcp`**, el servidor MCP oficial de jgraph (comentarios en `diagramly/ElkLayout.js`,
  `libavoid-js/libavoid-routing.js`).
- **Entradas de texto**: Mermaid → XML drawio (`EditorUi.parseMermaidDiagram`, con
  post-pase ELK), PlantUML (render vía servidor), CSV con directivas `# key: value`
  (`importCsv`).

## Excalidraw

- **Modelo**: array plano de elementos tipados (`rectangle`, `diamond`, `ellipse`, `arrow`,
  `line`, `text`, `frame`, `image`…). Base común: `id, x, y, width, height, angle,
  strokeColor, backgroundColor, fillStyle, roughness, seed, version, versionNonce,
  index (fractional), groupIds, frameId, boundElements, isDeleted`
  (`packages/element/src/types.ts:40`).
- **Relaciones**: flechas con `startBinding`/`endBinding` al elemento; el contenedor lista
  `boundElements`. Texto dentro de formas = elemento `text` con `containerId`.
- **API de esqueleto** (clave para generación por IA): `ExcalidrawElementSkeleton`
  + `convertToExcalidrawElements()` (`packages/element/src/transform.ts:215,572`).
  Permite declarar `{type, x, y, label:{text}}` y flechas con `start/end: {id}`
  sin calcular bindings, tamaños de texto ni ids.
- **Serialización**: JSON `{type:"excalidraw", version, source, elements, appState, files}`
  (`packages/excalidraw/data/json.ts:53`).
- **Render**: canvas/SVG con roughjs (estilo a mano) — `scene/export.ts`.
- **Texto → diagrama**: Mermaid vía `@excalidraw/mermaid-to-excalidraw`
  (`parseMermaidToExcalidraw` → esqueleto → `convertToExcalidrawElements`, con reintento
  bajando tamaño de fuente; `components/TTDDialog/common.ts`).

## Implicaciones para ChartsIA

1. Un **modelo intermedio propio, semántico** (nodos, relaciones, contenedores, tipo de
   diagrama) y exportadores a drawio XML / Excalidraw JSON / SVG / Mermaid.
2. Los LLM deben producir **esqueletos declarativos** (como el de Excalidraw), nunca
   coordenadas absolutas obligatorias: el layout lo resuelve el servidor (ELK).
3. Estilo y semántica separados: el tipo UML/arquitectura es semántico; el estilo visual
   se deriva (lección de los strings de estilo de drawio).
4. Mermaid/PlantUML como formatos de entrada interoperables, no como modelo interno.
