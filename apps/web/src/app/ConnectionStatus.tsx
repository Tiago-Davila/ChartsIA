export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connected: 'Conectado al hub',
  reconnecting: 'Reconectando…',
  disconnected: 'Sin conexión con el hub',
};
