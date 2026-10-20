import { Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { type Namespace, type Socket } from 'socket.io';
import { ACCESS_TOKEN, tokensMatch } from '../auth/token.js';
import { type AccessToken } from '../auth/bearer.guard.js';
import { DiagramEvents } from '../diagrams/diagram-events.js';

const room = (diagramId: string) => `diagram:${diagramId}`;

/**
 * Tiempo real app ↔ hub (Socket.IO, namespace `/live`, transporte en `/socket.io`).
 * La app se suscribe a un diagrama y recibe sus cambios; creación y activación se difunden
 * a todos. El handshake exige `auth.token` cuando el hub no está en loopback.
 */
@WebSocketGateway({ namespace: '/live' })
export class LiveGateway implements OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger('LiveGateway');
  private unsubscribe?: () => void;

  @WebSocketServer()
  private server!: Namespace;

  constructor(
    private readonly events: DiagramEvents,
    @Inject(ACCESS_TOKEN) private readonly token: AccessToken,
  ) {}

  afterInit(server: Namespace): void {
    server.use((socket, next) => {
      if (this.token === undefined) return next();
      const received = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof received === 'string' && tokensMatch(this.token, received)) return next();
      next(new Error('unauthorized'));
    });
    this.unsubscribe = this.events.subscribe((event) => {
      switch (event.name) {
        case 'diagram.updated':
          this.server.to(room(event.payload.diagramId)).emit(event.name, event.payload);
          break;
        case 'diagram.created':
        case 'active.changed':
          this.server.emit(event.name, event.payload);
          break;
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() socket: Socket, @MessageBody() body: { diagramId?: unknown }): Promise<{ ok: boolean }> {
    if (typeof body?.diagramId !== 'string' || body.diagramId.length > 64) return { ok: false };
    for (const joined of socket.rooms) if (joined.startsWith('diagram:')) await socket.leave(joined);
    await socket.join(room(body.diagramId));
    this.logger.debug(`socket suscrito a ${body.diagramId}`);
    return { ok: true };
  }
}
