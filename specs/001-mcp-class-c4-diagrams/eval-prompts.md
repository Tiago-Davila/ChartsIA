# Conjunto de evaluación con agentes reales

**Feature**: `001-mcp-class-c4-diagrams` | Uso: tareas T144 (Claude) y T145 (GPT).

Ejecutar cada petición en una conversación nueva con el agente conectado a ChartsIA y anotar
el resultado en [validation-report.md](./validation-report.md).

## A. Peticiones de diagramas (SC-002: ≥ 95 % sin solapes, 19 de 20)

Criterio de aceptación por petición: el diagrama aparece en la app con todos los elementos
pedidos, **ningún nodo se solapa con otro** y ninguna relación atraviesa un nodo (comprobable
con `get_diagram includeLayout:true`), y la notación es la del tipo pedido.

| # | Tipo | Petición |
|---|------|----------|
| A1 | class | Diagrama de clases de una biblioteca con Libro, Autor, Socio y Préstamo. |
| A2 | class | Modelo de clases de un e-commerce: Cliente, Pedido, LineaPedido, Producto, Categoría, Pago (interfaz) con TarjetaCredito y PayPal. |
| A3 | class | Clases de un sistema de reservas de hotel con enum EstadoReserva. |
| A4 | class | Patrón Observer: Subject, Observer (interfaz) y dos observadores concretos. |
| A5 | class | Jerarquía de vehículos: Vehiculo abstracto, Coche, Moto, Camión, y una interfaz Electrico. |
| A6 | class | Dominio de una red social: Usuario, Publicación, Comentario, Reacción (enum) y Seguimiento. |
| A7 | class | Paquetes "dominio" e "infraestructura" con 3 clases cada uno y dependencias entre ellos. |
| A8 | class | Sistema de facturación con Factura compuesta por Líneas, Impuesto y Cliente; multiplicidades. |
| A9 | class | Patrón Strategy para cálculo de envíos con tres estrategias. |
| A10 | class | 25 clases de un ERP (inventario, compras, ventas) con relaciones entre módulos. |
| A11 | c4-context | Contexto de una banca online: cliente, sistema de banca, sistema de correo y mainframe externos. |
| A12 | c4-context | Contexto de una plataforma de streaming con usuarios, administradores y proveedores de contenido. |
| A13 | c4-container | Contenedores de una tienda online: web, API, BD, pasarela de pagos externa. |
| A14 | c4-container | Contenedores de una app de delivery: app móvil, API gateway, 3 microservicios, cola, 2 BD. |
| A15 | c4-container | Contenedores de un sistema de reservas con SPA, backend, caché y BD. |
| A16 | c4-component | Componentes de la API de pedidos: controladores, servicios, repositorios. |
| A17 | c4-component | Componentes del servicio de autenticación (login, tokens, usuarios, auditoría). |
| A18 | c4-container | Contenedores de un sistema IoT: dispositivos, broker MQTT, procesador de eventos, data lake. |
| A19 | c4-context | Contexto de un sistema hospitalario con 5 actores y 4 sistemas externos. |
| A20 | class | El modelo de A1 pero añadiendo después Editorial, renombrando Socio a Usuario y eliminando Préstamo (3 turnos). |

## B. Peticiones que provocan errores (SC-003: ≥ 90 % autocorregidas, 9 de 10)

Criterio de aceptación: la primera llamada recibe `isError` y, **sin intervención humana**, el
agente corrige la entrada en el siguiente turno y el diagrama acaba creado o modificado.

| # | Error esperado | Petición |
|---|----------------|----------|
| B1 | `UNKNOWN_REFERENCE` | Con A1 creado: «haz que Socio herede de Persona» (Persona no existe). |
| B2 | `RELATION_NOT_ALLOWED` | «Haz que la interfaz Prestable herede de la clase Libro». |
| B3 | `KIND_NOT_ALLOWED` | «En el diagrama de clases añade una persona "Bibliotecario" de C4». |
| B4 | `INVALID_PARENT` | «Diagrama C4 de componentes con un componente "Login" sin contenedor». |
| B5 | `INHERITANCE_CYCLE` | «Haz que Autor herede de Socio y Socio de Autor». |
| B6 | `DUPLICATE_ID` | «Añade otra clase Libro distinta de la existente» (el agente reutiliza el id). |
| B7 | `FIELD_NOT_ALLOWED` | «Pon multiplicidad 1..* a la herencia entre Coche y Vehículo». |
| B8 | `SCHEMA_VIOLATION` | «Ponle a la clase Pedido un color rojo» (campo inexistente). |
| B9 | `NO_ACTIVE_DIAGRAM` | En un hub sin diagramas: «añade la clase X al diagrama». |
| B10 | `LIMIT_EXCEEDED` | «Genera un diagrama de clases con 600 clases numeradas». |
