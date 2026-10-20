/**
 * Estado vacío "conecta tu agente". Los comandos replican la sección "Conectar agentes" de
 * specs/001-mcp-class-c4-diagrams/quickstart.md: mantenerlos sincronizados en el mismo PR.
 */
export function EmptyState({ origin }: { origin: string }) {
  const mcpUrl = `${origin}/mcp`;
  const openai = JSON.stringify({ type: 'mcp', server_label: 'chartsia', server_url: mcpUrl, authorization: '<CHARTSIA_TOKEN>' });
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <h2 id="empty-title">Conecta tu agente</h2>
      <p>Pide un diagrama de clases o C4 a Claude o GPT y aparecerá aquí al instante.</p>
      <dl>
        <dt>Claude Code (HTTP)</dt>
        <dd><code>claude mcp add --transport http chartsia {mcpUrl}</code></dd>
        <dt>Claude Desktop (stdio)</dt>
        <dd><code>pnpm --filter @chartsia/api exec chartsia-mcp</code></dd>
        <dt>OpenAI Responses API</dt>
        <dd><code>{openai}</code></dd>
      </dl>
      <p className="empty-state__example">Por ejemplo: «Haz un diagrama de clases de una biblioteca con Libro, Autor, Socio y Préstamo».</p>
    </section>
  );
}
