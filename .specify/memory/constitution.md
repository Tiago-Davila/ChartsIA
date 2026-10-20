<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: placeholders → definitive principles
  - [PRINCIPLE_1_NAME] → I. MCP-First, agnóstico de proveedor
  - [PRINCIPLE_2_NAME] → II. Modelo semántico canónico
  - [PRINCIPLE_3_NAME] → III. Entrada declarativa, layout automático y determinista
  - [PRINCIPLE_4_NAME] → IV. Validación y errores accionables (NO NEGOCIABLE)
  - [PRINCIPLE_5_NAME] → V. Test-First con contratos y golden files
  - added → VI. Simplicidad y seguridad por defecto
- Added sections: "Restricciones técnicas", "Flujo de desarrollo y quality gates"
- Removed sections: none
- Templates: plan/spec/tasks templates read the constitution at runtime; not modified
  by this command (scope guard).
- Follow-up TODOs: none
- Reference: docs/research/drawio-excalidraw.md
-->

# ChartsIA Constitution

ChartsIA genera diagramas UML (clases, secuencia, componentes, estados, casos de uso, ER) y
de arquitectura (C4, cloud/AWS/Azure/GCP, Kubernetes, despliegue) y los expone como servidor
MCP consumible por Claude y por GPT (OpenAI).

## Core Principles

### I. MCP-First, agnóstico de proveedor

- Toda capacidad del producto MUST exponerse como herramienta MCP con un esquema de entrada
  y salida JSON Schema estricto (`additionalProperties: false`, campos requeridos explícitos).
- UI, CLI y cualquier otra superficie MUST ser clientes del mismo núcleo; ninguna
  funcionalidad puede existir solo en una superficie.
- El servidor MUST funcionar sin cambios con clientes Claude (Claude Code/Desktop, Messages
  API connector) y OpenAI (Responses API remote MCP, Apps SDK). Está prohibida la lógica
  condicionada al proveedor del modelo; las diferencias se resuelven ajustándose al
  subconjunto común de JSON Schema que ambos aceptan.
- Transportes soportados: stdio y Streamable HTTP. Los resultados MUST incluir contenido
  estructurado y, cuando aplique, el artefacto renderizado (SVG/PNG) o un recurso MCP.

**Rationale**: los LLM son el usuario principal; un único contrato evita divergencias entre
clientes y hace el producto portable.

### II. Modelo semántico canónico

- El núcleo MUST operar sobre un modelo intermedio propio y semántico: diagrama (tipo),
  nodos (con kind UML/arquitectura), relaciones tipadas, contenedores/grupos y metadatos.
- El modelo MUST ser independiente del render: no contiene coordenadas obligatorias ni
  estilos de un formato concreto. Estilo visual = función derivada del tipo semántico más
  un tema.
- draw.io XML (`mxGraphModel`), Excalidraw JSON, SVG/PNG, Mermaid y PlantUML son
  importadores/exportadores en los bordes. Ningún formato externo MUST usarse como modelo
  interno.
- Cada exportador MUST producir archivos que abran sin errores en su herramienta de origen.

**Rationale**: draw.io acopla semántica a strings de estilo y Excalidraw a geometría; un
modelo semántico propio permite validar reglas UML y exportar a todos los formatos.

### III. Entrada declarativa, layout automático y determinista

- Las herramientas MUST aceptar esqueletos declarativos (nodos, relaciones, etiquetas,
  contenedores) sin exigir posiciones ni tamaños, al estilo de `ExcalidrawElementSkeleton`.
- El servidor MUST resolver layout y enrutado de aristas (ELK vía elkjs); las coordenadas
  explícitas son opcionales y solo actúan como pistas o fijaciones.
- La misma entrada y versión MUST producir la misma salida byte a byte (IDs estables,
  orden estable, sin aleatoriedad sin semilla fija).
- Las operaciones de edición MUST ser incrementales (añadir/quitar/modificar elementos por
  ID) para que un LLM refine un diagrama sin reenviarlo completo.

**Rationale**: los LLM son malos calculando geometría y buenos describiendo estructura; el
determinismo hace los resultados testeables y reproducibles.

### IV. Validación y errores accionables (NO NEGOCIABLE)

- Toda entrada MUST validarse contra el esquema y contra reglas de dominio (p. ej. relación
  de herencia solo entre clasificadores, mensajes de secuencia entre lifelines existentes,
  referencias a IDs inexistentes, ciclos prohibidos) antes de renderizar.
- Los errores MUST ser estructurados: código estable, ruta JSON del campo, mensaje legible y
  sugerencia de corrección, de modo que un LLM pueda arreglarlo en el siguiente turno.
- Nunca se MUST devolver un diagrama parcialmente inválido como éxito; las advertencias no
  bloqueantes se reportan por separado.

**Rationale**: el bucle LLM → herramienta → corrección solo converge si los errores son
precisos y accionables.

### V. Test-First con contratos y golden files

- Cada herramienta MCP MUST tener contract tests de su esquema (entradas válidas e
  inválidas) escritos antes de la implementación.
- Cada exportador MUST tener golden files versionados; un cambio en la salida exige revisar
  y actualizar el golden explícitamente en el PR.
- Las reglas de validación de dominio MUST tener tests unitarios por regla.
- Debe existir al menos un test de integración end-to-end por transporte (stdio y HTTP).

**Rationale**: el contrato MCP es la API pública; romperlo silenciosamente rompe a todos los
clientes LLM.

### VI. Simplicidad y seguridad por defecto

- YAGNI: no se añaden tipos de diagrama, formatos ni dependencias sin una spec que los
  justifique. La complejidad añadida MUST justificarse en el plan.
- El servidor MUST NOT ejecutar código suministrado por el usuario ni descargar recursos
  remotos indicados en la entrada (imágenes, stencils, URLs) salvo allowlist explícita.
- Etiquetas y textos MUST sanitizarse en SVG/HTML/XML (sin `<script>`, handlers ni
  entidades externas); los parsers de importación MUST deshabilitar XXE.
- Límites configurables de tamaño (nodos, aristas, bytes de entrada, tiempo de layout).
- Logs estructurados sin secretos ni contenido completo de diagramas por defecto.
- Los esquemas de herramientas MCP siguen versionado semántico; cambios incompatibles
  requieren MAJOR y nota de migración.

**Rationale**: un servidor MCP expuesto por HTTP recibe entrada no confiable generada por
modelos; la superficie mínima es la más segura y mantenible.

## Restricciones técnicas

- Lenguaje y runtime: TypeScript estricto sobre Node.js LTS.
- MCP: SDK oficial `@modelcontextprotocol/sdk`.
- Layout: elkjs (ELK). Enrutado ortogonal opcional; cualquier motor adicional requiere ADR.
- Formatos de salida mínimos: SVG, draw.io XML, Excalidraw JSON; PNG y Mermaid/PlantUML se
  priorizan por spec.
- La investigación de referencia (`docs/research/drawio-excalidraw.md`) guía decisiones de
  formato; no se copia código de draw.io ni de Excalidraw sin verificar su licencia.

## Flujo de desarrollo y quality gates

- Flujo spec-kit obligatorio: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`. Toda feature tiene spec y plan antes de código.
- Ramas de feature desde `develop`; PRs hacia `develop` y releases de `develop` a `master`.
- Un PR solo se fusiona si: pasan typecheck, lint y tests (contratos, golden, e2e), el plan
  incluye el "Constitution Check" sin violaciones injustificadas, y los cambios de esquema
  MCP están versionados.
- Commits semánticos (Conventional Commits).

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o guía del repositorio.
- Enmiendas: PR que modifique este archivo con justificación, Sync Impact Report actualizado
  y plan de migración si afecta a features existentes.
- Versionado de la constitución: MAJOR para eliminar o redefinir principios de forma
  incompatible; MINOR para añadir principios o secciones o ampliarlos materialmente; PATCH
  para aclaraciones y redacción.
- Cumplimiento: cada `plan.md` MUST incluir el Constitution Check; cada revisión de PR MUST
  verificar los principios I–VI. Las excepciones se documentan en la sección de complejidad
  del plan.

**Version**: 1.0.0 | **Ratified**: 2026-10-19 | **Last Amended**: 2026-10-19
