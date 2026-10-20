# Contract: API interna app ↔ hub

Consumida solo por `apps/web`. Misma auth que `/mcp` (Bearer cuando no es loopback).
Toda escritura pasa por el mismo servicio de operaciones que usan las herramientas MCP.

## Autenticación de la app

- En loopback no hay token: la app funciona sin configuración.
- Fuera de loopback, el hub imprime al arrancar la URL de la app con el token en el fragmento:
  `{CHARTSIA_PUBLIC_URL}/#token=<CHARTSIA_TOKEN>`. El fragmento no llega al servidor ni a los
  logs. La app lo lee una vez, lo guarda en `sessionStorage` y lo borra de la barra de
  direcciones con `history.replaceState`.
- La app envía el token como `Authorization: Bearer <token>` en REST y como
  `auth: { token }` en el handshake de Socket.IO.
- Sin token válido, REST responde 401 y el handshake se rechaza; la app muestra una pantalla
  que pide pegar el token.

## Servido de la app

- En desarrollo, Vite sirve la app en `:5173` y hace proxy de `/api`, `/mcp` y `/socket.io`
  (con `ws: true`) al hub.
- Fuera de desarrollo, el hub sirve `apps/web/dist` en `/`, con fallback a `index.html` para
  las rutas de la app (`/d/:id`). `/api`, `/mcp` y `/socket.io` tienen prioridad.

## Rutas de la app

| Ruta | Pantalla |
|------|----------|
| `/` | diagrama activo, o estado vacío si no hay ninguno |
| `/d/:id` | diagrama `:id` (destino de `viewUrl`); al abrirla, la app llama a `activate` |

## REST (`/api`)

| Método | Ruta | Cuerpo / Respuesta |
|--------|------|--------------------|
| GET | `/api/diagrams` | → `list_diagrams` output |
| GET | `/api/diagrams/:id` | → `Diagram` con `layout` y `route`; 404 si no existe |
| POST | `/api/diagrams/:id/operations` | `{ baseRevision, operations }` → `apply_changes` output; 422 con `{errors}` |
| POST | `/api/diagrams/:id/activate` | marca diagrama activo (igual que la tool `open_diagram`) → 204 |
| GET | `/api/diagrams/:id/export?format=svg\|drawio\|excalidraw&style=` | archivo con `Content-Disposition` |
| GET | `/api/health` | `{ status: "ok", version }` (sin auth) |

## WebSocket (Socket.IO, namespace `/live`, path de transporte `/socket.io`)

El namespace no es una ruta HTTP: el cliente conecta a `io("/live")` y el tráfico va por
`/socket.io/`, que es lo que debe proxiarse.

| Dirección | Evento | Payload |
|-----------|--------|---------|
| cliente → hub | `subscribe` | `{ diagramId }` (une a la room del diagrama) |
| hub → cliente | `diagram.updated` | `{ diagramId, revision, origin: "agent"\|"app", diagram }` |
| hub → cliente | `diagram.created` | `{ diagramId, title, type }` |
| hub → cliente | `active.changed` | `{ diagramId }` (la app navega al diagrama activo) |

Reconexión: al reconectar, la app reenvía `subscribe` y hace `GET /api/diagrams/:id`; si la
`revision` remota es mayor, reemplaza el estado local.
