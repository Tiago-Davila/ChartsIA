export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connected: 'Conectado al hub',
  reconnecting: 'Reconectando…',
  disconnected: 'Sin conexión con el hub',
};

/** Estado del canal en vivo con el hub. */
export function ConnectionStatus({ state }: { state: ConnectionState }) {
  return (
    <div className={`connection connection--${state}`} role="status" aria-live="polite">
      <span className="connection__dot" aria-hidden />
      {CONNECTION_LABELS[state]}
    </div>
  );
}
