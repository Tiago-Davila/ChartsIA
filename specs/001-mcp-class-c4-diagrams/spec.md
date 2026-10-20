# Feature Specification: Diagramas de clases y C4 generados por agentes vía MCP

**Feature Branch**: `001-mcp-class-c4-diagrams`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "servidor MCP para diagramas de clases y C4, se le tiene que decir al agente y conectado al mcp se tiene que hacer el diagrama en la app, usa, formas y figuras de los dos repos, podes hacer el canvas infinito con react flow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pedir un diagrama de clases al agente y verlo en la app (Priority: P1)

Una persona conversa con su agente de IA (Claude o GPT) que tiene conectado el servidor de
ChartsIA. Le describe en lenguaje natural un dominio ("un sistema de pedidos con Cliente,
Pedido, LineaPedido y Producto; Pedido compone LineaPedido…"). El agente invoca las
herramientas del servidor y el diagrama de clases aparece en la app, en un lienzo infinito,
con clases (nombre, atributos, operaciones, visibilidad), relaciones UML correctas y una
disposición legible sin que nadie haya colocado nada a mano.

**Why this priority**: es el flujo central del producto: "le digo al agente y el diagrama
aparece". Sin esto no hay producto.

**Independent Test**: con la app abierta y un agente conectado, pedir un diagrama de clases
de 5–10 clases y verificar que aparece completo, correcto y legible en el lienzo.

**Acceptance Scenarios**:

1. **Given** la app abierta y un agente conectado al servidor, **When** la persona pide "haz
   un diagrama de clases de un sistema de biblioteca", **Then** el diagrama aparece en la app
   con las clases y relaciones descritas, sin solapamientos entre elementos.
2. **Given** un diagrama de clases mostrado, **When** se inspecciona una clase, **Then** se
   ven sus compartimentos de nombre, atributos y operaciones con su visibilidad (+, -, #, ~)
   y tipos cuando el agente los indicó.
3. **Given** el agente envía una relación hacia una clase inexistente, **When** el servidor
   la procesa, **Then** rechaza la petición con un error que indica qué elemento falta y
   cómo corregirlo, y el diagrama visible no queda en un estado inválido.
4. **Given** la misma descripción estructural enviada dos veces, **When** se genera,
   **Then** el resultado visual es idéntico.

---

### User Story 2 - Pedir un diagrama de arquitectura C4 (Priority: P2)

La persona pide al agente un diagrama C4 (Contexto, Contenedores o Componentes) de un
sistema. El agente envía personas, sistemas de software, sistemas externos, contenedores,
componentes, límites (boundaries) y relaciones con su descripción y tecnología. La app lo
muestra con la notación C4 reconocible: formas y colores diferenciados por tipo, límites
como contenedores agrupadores y etiquetas en las relaciones.

**Why this priority**: es el segundo tipo de diagrama pedido explícitamente y el más usado
para arquitectura; reutiliza el flujo de la historia 1.

**Independent Test**: pedir "diagrama de contenedores C4 de una tienda online con web,
API, base de datos y pasarela de pagos externa" y verificar notación, agrupación y
etiquetas.

**Acceptance Scenarios**:

1. **Given** un agente conectado, **When** pide un diagrama C4 de contexto, **Then** se
   muestran personas, el sistema principal y sistemas externos con formas distintas y
   relaciones etiquetadas.
2. **Given** un diagrama de contenedores con un límite de sistema, **When** se muestra,
   **Then** los contenedores aparecen dentro del límite y los elementos externos fuera.
3. **Given** una relación C4 con descripción y tecnología, **When** se muestra, **Then** la
   etiqueta presenta ambas (p. ej. "Lee/escribe [SQL/TCP]").
4. **Given** el agente intenta poner un componente fuera de un contenedor en un diagrama de
   componentes, **When** se valida, **Then** se devuelve un error accionable.

---

### User Story 3 - Refinar el diagrama conversando (Priority: P2)

Con un diagrama ya visible, la persona pide cambios ("añade una clase Autor y relaciónala
con Libro", "renombra API a Backend", "elimina la pasarela"). El agente aplica solo esos
cambios; la app los refleja en vivo conservando el resto del diagrama y, en lo posible, la
posición de lo que no cambió.

**Why this priority**: diagramar es iterativo; sin edición incremental el agente tendría que
regenerar todo y la persona perdería orientación.

**Independent Test**: sobre un diagrama existente, pedir tres cambios sucesivos y verificar
que cada uno se refleja sin recrear ni desordenar los elementos no afectados.

**Acceptance Scenarios**:

1. **Given** un diagrama visible, **When** el agente añade un elemento, **Then** aparece en
   la app sin recargarla y los elementos existentes no cambian de posición salvo lo
   necesario para evitar solapamientos.
2. **Given** un diagrama visible, **When** el agente elimina un elemento, **Then** también
   desaparecen sus relaciones.
3. **Given** el agente necesita saber qué hay en el diagrama, **When** consulta el estado,
   **Then** recibe la estructura actual, incluidos los cambios manuales hechos en la app.

---

### User Story 4 - Navegar y ajustar el diagrama en el lienzo infinito (Priority: P3)

La persona navega el diagrama en un lienzo infinito (desplazar, zoom, ajustar a pantalla,
minimapa), mueve elementos a mano, edita textos y cambia entre estilo limpio (tipo draw.io)
y estilo boceto a mano alzada (tipo Excalidraw). Los cambios manuales quedan en el
diagrama y el agente los ve.

**Why this priority**: mejora la usabilidad y el acabado, pero el valor principal ya está en
las historias 1–3.

**Independent Test**: abrir un diagrama generado, hacer zoom, mover un nodo, editar un
nombre, cambiar el estilo y verificar que todo persiste tras recargar la app.

**Acceptance Scenarios**:

1. **Given** un diagrama grande, **When** la persona usa "ajustar a pantalla", **Then** todo
   el diagrama queda visible.
2. **Given** un nodo movido a mano, **When** el agente añade otro elemento, **Then** el nodo
   movido conserva su posición.
3. **Given** el estilo boceto activado, **When** se mira el diagrama, **Then** formas y
   líneas tienen trazo a mano alzada y la notación UML/C4 sigue siendo reconocible.

---

### User Story 5 - Exportar el diagrama (Priority: P3)

La persona (o el agente) exporta el diagrama a imagen vectorial, a archivo de draw.io y a
archivo de Excalidraw para usarlo en documentación o seguir editándolo en esas herramientas.

**Why this priority**: da salida al trabajo y cumple el principio de interoperabilidad, pero
no es necesario para validar el flujo principal.

**Independent Test**: exportar un diagrama de clases y uno C4 a los tres formatos y abrir
cada archivo en su herramienta de destino.

**Acceptance Scenarios**:

1. **Given** un diagrama visible, **When** se exporta a draw.io, **Then** el archivo abre en
   draw.io mostrando las mismas clases/elementos y relaciones.
2. **Given** un diagrama visible, **When** se exporta a Excalidraw, **Then** el archivo abre
   en Excalidraw con elementos y flechas conectadas.
3. **Given** un diagrama visible, **When** se exporta a imagen vectorial, **Then** el
   resultado coincide visualmente con lo que muestra la app.

---

### Edge Cases

- El agente envía una descripción inválida (tipo de relación inexistente, IDs duplicados,
  campos obligatorios vacíos): se rechaza completa con errores por campo; nada cambia en la
  app.
- El agente pide un diagrama mientras la app no está abierta: el diagrama se crea igual y
  aparece al abrir la app; el agente recibe un enlace o identificador para verlo.
- Hay varios diagramas: el agente debe indicar sobre cuál trabaja; si no lo indica, se usa
  el diagrama activo y la respuesta dice cuál fue.
- El agente y la persona editan el mismo elemento casi a la vez: gana el último cambio
  aplicado y la otra parte ve el estado resultante; no se corrompe el diagrama.
- Diagramas grandes (más de 100 elementos): siguen siendo navegables; si se supera el
  límite máximo, se devuelve un error que indica el límite.
- Textos con caracteres especiales, HTML o scripts en nombres: se muestran como texto
  literal y nunca se ejecutan.
- Se pierde la conexión entre app y servidor: la app lo indica y se resincroniza al
  reconectar sin perder cambios.
- Mezcla de notaciones (una relación UML de herencia en un diagrama C4): se rechaza con
  error explicativo.

## Requirements *(mandatory)*

### Functional Requirements

**Conexión con agentes**

- **FR-001**: El sistema MUST ofrecer herramientas consumibles por agentes de IA mediante el
  Model Context Protocol, usables tanto desde clientes de Claude como de GPT con el mismo
  contrato.
- **FR-002**: El sistema MUST ser utilizable desde un agente local (en la misma máquina) y
  desde un agente remoto a través de una dirección de red.
- **FR-003**: Cada herramienta MUST describir sus parámetros y resultados de forma que el
  agente sepa usarla sin instrucciones adicionales (descripciones y ejemplos incluidos).

**Herramientas de diagrama**

- **FR-004**: Los agentes MUST poder crear un diagrama indicando su tipo (clases, C4
  contexto, C4 contenedores, C4 componentes) y un título.
- **FR-005**: Los agentes MUST poder describir el diagrama de forma estructural (elementos,
  relaciones, agrupaciones) sin indicar posiciones ni tamaños.
- **FR-006**: Los agentes MUST poder añadir, modificar y eliminar elementos y relaciones
  individuales por identificador sin reenviar el diagrama completo.
- **FR-007**: Los agentes MUST poder consultar el estado actual de un diagrama (incluidos
  cambios hechos a mano) y listar los diagramas existentes.
- **FR-008**: Los agentes MUST poder solicitar la exportación de un diagrama y recibir el
  resultado o un enlace a él.
- **FR-009**: Cada operación MUST devolver un resumen del resultado y un identificador o
  enlace para ver el diagrama en la app.

**Diagramas de clases**

- **FR-010**: El sistema MUST soportar clases, clases abstractas, interfaces y
  enumeraciones, con atributos y operaciones (nombre, tipo, visibilidad, parámetros,
  modificadores estático/abstracto).
- **FR-011**: El sistema MUST soportar las relaciones: asociación (con nombre,
  multiplicidades y navegabilidad), agregación, composición, herencia, realización y
  dependencia, cada una con su notación UML estándar (tipo de punta y línea).
- **FR-012**: El sistema MUST soportar agrupación en paquetes.

**Diagramas C4**

- **FR-013**: El sistema MUST soportar los elementos C4: persona, sistema de software,
  sistema externo, contenedor (incluida variante base de datos y cola), componente y límite
  (de sistema, de contenedor o empresa).
- **FR-014**: Las relaciones C4 MUST admitir descripción y tecnología.
- **FR-015**: El sistema MUST mostrar cada tipo de elemento C4 con forma, color y etiqueta
  de tipo diferenciados según la notación C4 habitual, e incluir una leyenda.

**Validación**

- **FR-016**: El sistema MUST validar cada petición antes de aplicarla (estructura, IDs
  únicos, referencias existentes, relaciones permitidas según el tipo de diagrama).
- **FR-017**: Ante una petición inválida, el sistema MUST rechazarla completa y devolver
  errores que indiquen el elemento afectado, el problema y una sugerencia de corrección.

**Disposición y visualización**

- **FR-018**: El sistema MUST calcular automáticamente una disposición legible: sin
  solapamiento de elementos, relaciones que eviten atravesar elementos y agrupaciones que
  contengan a sus hijos.
- **FR-019**: La misma entrada MUST producir el mismo resultado visual.
- **FR-020**: En ediciones incrementales, el sistema MUST conservar la posición de los
  elementos no afectados y de los que la persona movió a mano.
- **FR-021**: La app MUST mostrar los cambios hechos por el agente en vivo, sin que la
  persona recargue.
- **FR-022**: La app MUST ofrecer un lienzo infinito con desplazamiento, zoom, ajustar a
  pantalla y minimapa.
- **FR-023**: La app MUST permitir mover elementos, editar textos y eliminar elementos a
  mano, y esos cambios MUST quedar disponibles para el agente.
- **FR-024**: La app MUST ofrecer al menos dos estilos visuales: limpio (inspirado en las
  formas de draw.io) y boceto a mano alzada (inspirado en Excalidraw), intercambiables sin
  alterar el contenido.
- **FR-025**: La app MUST listar los diagramas existentes y permitir abrir cualquiera.

**Persistencia y exportación**

- **FR-026**: Los diagramas MUST persistir entre reinicios del servidor y de la app.
- **FR-027**: El sistema MUST exportar a imagen vectorial (SVG), a archivo de draw.io y a
  archivo de Excalidraw, y los archivos MUST abrirse correctamente en esas herramientas.

**Seguridad y límites**

- **FR-028**: Todo texto recibido MUST mostrarse como texto literal; nunca se interpreta como
  código o marcado.
- **FR-029**: El sistema MUST aplicar un límite configurable de elementos por diagrama
  (por defecto 500) y de tamaño de petición, informando el límite al rechazar.
- **FR-030**: Cuando el servidor sea accesible por red, MUST exigir un token de acceso
  configurable; en uso local por la misma máquina puede omitirse.

### Key Entities

- **Diagrama**: unidad de trabajo. Tipo (clases, C4 contexto/contenedores/componentes),
  título, elementos, relaciones, estilo visual, fecha de creación y modificación.
- **Elemento**: nodo del diagrama con identificador estable, tipo (clase, interfaz,
  enumeración, persona, sistema, contenedor, componente…), nombre, descripción, propiedades
  específicas del tipo (atributos, operaciones, tecnología) y posición (calculada o fijada a
  mano).
- **Miembro de clase**: atributo u operación con visibilidad, tipo, parámetros y
  modificadores.
- **Relación**: conexión dirigida entre dos elementos con tipo (herencia, composición,
  relación C4…), etiqueta, multiplicidades/tecnología según el tipo.
- **Agrupación**: paquete UML o límite C4 que contiene elementos.
- **Exportación**: representación del diagrama en un formato externo (SVG, draw.io,
  Excalidraw).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde que el agente envía un diagrama de hasta 30 elementos, la persona lo ve
  en la app en menos de 2 segundos.
- **SC-002**: En un conjunto de 20 peticiones de prueba (10 de clases, 10 de C4), el 95 % de
  los diagramas generados no tiene elementos solapados ni relaciones que atraviesen
  elementos.
- **SC-003**: Al menos el 90 % de las peticiones que el agente envía con errores se
  corrigen en el siguiente intento del agente usando solo el mensaje de error devuelto.
- **SC-004**: El mismo flujo de prueba (crear, refinar tres veces, exportar) funciona sin
  cambios con un agente Claude y con un agente GPT.
- **SC-005**: El 100 % de los archivos exportados a draw.io y Excalidraw en el conjunto de
  prueba abre sin errores en su herramienta con todos sus elementos y relaciones.
- **SC-006**: Diagramas de 200 elementos se pueden desplazar y ampliar con respuesta fluida
  (sin saltos perceptibles).
- **SC-007**: Una persona sin experiencia previa obtiene su primer diagrama de clases
  correcto pidiéndoselo al agente en menos de 3 minutos.

## Assumptions

- Usuario objetivo: desarrolladores y arquitectos que ya usan un agente de IA; una sola
  persona por instancia (sin colaboración multiusuario ni cuentas en esta versión).
- La app y el servidor se ejecutan en la máquina de la persona. Para usarlo desde GPT en la
  nube, la persona expone el servidor en una dirección pública (por ejemplo, con un túnel);
  el despliegue gestionado queda fuera de alcance.
- Solo diagramas de clases y C4 (contexto, contenedores, componentes). Secuencia, estados,
  ER, despliegue y otros tipos quedan para features futuras.
- La importación desde draw.io, Excalidraw, Mermaid o PlantUML queda fuera de alcance;
  solo exportación.
- Las formas y figuras se inspiran en las librerías de draw.io (UML 2.5 y C4) y en el
  estilo y las primitivas de Excalidraw. Ambos proyectos tienen licencias permisivas
  (Apache-2.0 y MIT); se mantiene la atribución si se reutilizan recursos.
- Restricción indicada por la persona usuaria: el lienzo infinito se construye con React Flow.
- La resolución de conflictos de edición simultánea usa "gana el último cambio"; no hay
  historial de versiones más allá de deshacer/rehacer en la sesión de la app.
- Referencia técnica: `docs/research/drawio-excalidraw.md` y la constitución del proyecto
  (v1.0.0).
