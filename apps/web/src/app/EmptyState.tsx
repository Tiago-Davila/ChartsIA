/** Estado vacío: invita a conectar un agente desde la pantalla de configuración. */
export function EmptyState({ onConfig }: { onConfig(): void }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <h2 id="empty-title">Conecta tu agente</h2>
      <p>Pide un diagrama de clases o C4 a Claude o GPT y aparecerá aquí al instante.</p>
      <p>
        Los comandos para conectarlo están en{' '}
        <a href="/config" onClick={(e) => { e.preventDefault(); onConfig(); }}>la configuración</a>.
      </p>
      <p className="empty-state__example">Por ejemplo: «Haz un diagrama de clases de una biblioteca con Libro, Autor, Socio y Préstamo».</p>
    </section>
  );
}
