<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/wordmark-dark.svg">
    <img src="docs/assets/wordmark-light.svg" alt="ChartsIA" width="360">
  </picture>
</p>

<p align="center">
  Diagramas UML, C4 y entidad-relación que tu agente de IA dibuja en vivo por MCP.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2024-5fa04e" alt="Node.js 24 o superior">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-MIT-blue" alt="Licencia MIT"></a>
</p>

<p align="center">
  <a href="#requisitos">Requisitos</a> ·
  <a href="#instalación">Instalación</a> ·
  <a href="#conectar-agentes">Conectar agentes</a> ·
  <a href="#cómo-probar">Cómo probar</a> ·
  <a href="#desarrollo">Desarrollo</a> ·
  <a href="#licencia">Licencia</a>
</p>

Le pides el diagrama a Claude, Codex u otro agente, el agente llama a las herramientas MCP de
ChartsIA y el diagrama aparece al instante en un lienzo infinito. Ahí lo sigues editando a mano
o lo exportas a SVG, draw.io o Excalidraw. Todo corre en tu máquina.

<p align="center">
  <img src="https://github.com/user-attachments/assets/0b9d563e-061b-4473-a58b-bf6c50299a2f" alt="Lienzo de ChartsIA con un diagrama dibujado por un agente" width="900">
</p>

## Requisitos

- Node.js 24 LTS o superior.
- Un agente con soporte MCP: Claude Code, Claude Desktop, Codex CLI, Gemini CLI, Grok Build u OpenCode.

## Instalación

```bash
npx chartsia
```

Abre la app en <http://chartsia.localhost:24278>. El hub queda escuchando en esa dirección y el
MCP en `http://127.0.0.1:24278/mcp`. Los diagramas se guardan en `~/.chartsia/diagrams`, así que
actualizar ChartsIA no los borra.

## Conectar agentes

Con el hub corriendo, copia el comando de tu agente. Todos quedan disponibles en todas tus carpetas.

**Claude Code**

```bash
claude mcp add --transport http --scope user chartsia http://127.0.0.1:24278/mcp
```

**Codex CLI**

```bash
codex mcp add chartsia --url http://127.0.0.1:24278/mcp
```

**Gemini CLI**

```bash
gemini mcp add --scope user --transport http chartsia http://127.0.0.1:24278/mcp
```

**Grok Build**

```bash
grok mcp add --transport http chartsia http://127.0.0.1:24278/mcp
```

**OpenCode**

```bash
opencode mcp add chartsia --url http://127.0.0.1:24278/mcp
```

Para Claude Desktop y los demás clientes por stdio, la pantalla **Configuración** de la app
muestra el bloque listo para pegar.

### Skills

Las skills le enseñan al agente a diseñar el diagrama, en qué orden llamar a las herramientas y
cómo revisar el resultado. Se instalan una vez para todos tus agentes:

```bash
npx skills add Tiago-Davila/ChartsIA -g --skill '*'
```

## Cómo probar

Con la app abierta, pídele un diagrama a tu agente:

```text
/chartsia-crear-diagrama crea un diagrama de clases de una biblioteca: socios, libros,
autores y préstamos. Un socio puede tener varios préstamos activos y cada libro tiene uno
o más autores.
```

<!-- Video de la prueba: arrastra el .mp4 al editor de GitHub y deja la URL sola en esta línea. -->

## Desarrollo

Requiere también pnpm 11.

```bash
git clone https://github.com/Tiago-Davila/ChartsIA && cd ChartsIA
pnpm install
pnpm dev                                   # hub en :24278 y app con recarga en :5173
pnpm build && pnpm --filter chartsia start # un solo proceso, como el paquete de npm
pnpm test && pnpm typecheck && pnpm lint
```

| Paquete | Contenido |
|---------|-----------|
| `packages/core` | Modelo, validación, layout, formas y exportadores (se publica como `@chartsia/core`) |
| `apps/api` | Hub Nest.js: MCP, REST, Socket.IO y puente stdio (se publica como `chartsia`) |
| `apps/web` | App React + React Flow |

## Licencia

MIT; el texto completo está en [LICENSE](LICENSE). Los avisos de dependencias y recursos de
terceros están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
