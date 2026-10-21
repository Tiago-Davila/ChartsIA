import { type Diagram, type DiagramType } from '@chartsia/core/model';
import { io, type Socket } from 'socket.io-client';
import { type ConnectionState } from '../app/ConnectionStatus';

export interface DiagramUpdatedEvent {
  diagramId: string;
  revision: number;
  origin: 'agent' | 'app';
  diagram: Diagram;
}

export interface LiveHandlers {
  onUpdated(event: DiagramUpdatedEvent): void;
  onCreated(event: { diagramId: string; title: string; type: DiagramType }): void;
  onProjectsChanged(): void;
  onActiveChanged(event: { diagramId: string }): void;
  onStatus(state: ConnectionState): void;
  /** Tras cada (re)conexión: la app reconcilia el estado con `GET`. */
  onConnected(): void;
  onUnauthorized(): void;
}

/**
 * Canal en vivo con el hub: Socket.IO, namespace `/live` sobre el path `/socket.io`. Al
 * reconectar reenvía `subscribe` del diagrama abierto.
 */
export function createLiveClient(getToken: () => string | undefined, handlers: LiveHandlers, url = '/live') {
  let current: string | null = null;
  const socket: Socket = io(url, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getToken() }),
    reconnectionDelayMax: 5000,
  });

  const resubscribe = () => {
    if (current) socket.emit('subscribe', { diagramId: current });
  };

  socket.on('connect', () => {
    handlers.onStatus('connected');
    resubscribe();
    handlers.onConnected();
  });
  socket.on('disconnect', (reason) => handlers.onStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting'));
  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') {
      handlers.onStatus('disconnected');
      handlers.onUnauthorized();
    } else handlers.onStatus('reconnecting');
  });
  socket.on('diagram.updated', handlers.onUpdated);
  socket.on('diagram.created', handlers.onCreated);
  socket.on('projects.changed', handlers.onProjectsChanged);
  socket.on('active.changed', handlers.onActiveChanged);

  return {
    subscribe(diagramId: string | null) {
      current = diagramId;
      if (socket.connected) resubscribe();
    },
    /** Reintenta con el token actual (tras pegarlo en la pantalla de token). */
    reconnect() {
      socket.disconnect().connect();
    },
    get connected() {
      return socket.connected;
    },
    close() {
      socket.close();
    },
  };
}

export type LiveClient = ReturnType<typeof createLiveClient>;
