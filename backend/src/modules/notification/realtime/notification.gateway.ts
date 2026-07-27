import { Logger } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { JwtService } from '@nestjs/jwt';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import type { Server, Socket } from 'socket.io';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { NotificationConnectionRegistry } from './notification-connection.registry';

type JwtPayload = {
  readonly sub?: string;
  readonly userId?: string;
  readonly id?: string;
  readonly role?: string;
};

type CountRow = {
  count: number;
};

export type RealtimeNotificationPayload = {
  readonly notificationId: string;
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly type: string;
  readonly metadata?: Record<string, unknown> | null;
  readonly actorId?: string;
  readonly occurredAt: string;
};

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly registry: NotificationConnectionRegistry,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        client.disconnect(true);

        return;
      }

      const payload = await this.verifyToken(token);

      const userId = this.extractUserId(payload);

      if (!userId) {
        client.disconnect(true);

        return;
      }

      await this.assertActiveUserExists(userId);

      this.getSocketData(client).userId = userId;

      this.registry.register(client.id, userId);

      await client.join(this.getUserRoom(userId));

      client.emit('notification.connected', {
        userId,
        connectedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : String(error));

      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.registry.unregister(client.id);
  }

  emitNotificationToUser(
    userId: string,
    payload: RealtimeNotificationPayload,
  ): number {
    const connectionCount = this.registry.countUserConnections(userId);

    if (connectionCount < 1) {
      return 0;
    }

    this.server
      .to(this.getUserRoom(userId))
      .emit('notification.received', payload);

    return connectionCount;
  }

  emitUnreadCountToUser(userId: string, count: number): number {
    const connectionCount = this.registry.countUserConnections(userId);

    if (connectionCount < 1) {
      return 0;
    }

    this.server.to(this.getUserRoom(userId)).emit('notification.unread_count', {
      userId,
      count,
      occurredAt: new Date().toISOString(),
    });

    return connectionCount;
  }

  @SubscribeMessage('notification.ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): {
    event: string;
    socketId: string;
    userId: string | null;
    received: unknown;
    occurredAt: string;
  } {
    const socketData = this.getSocketData(client);

    const userId =
      typeof socketData.userId === 'string' ? socketData.userId : null;

    return {
      event: 'notification.pong',
      socketId: client.id,
      userId,
      received: body,
      occurredAt: new Date().toISOString(),
    };
  }

  private getSocketData(client: Socket): Record<string, unknown> {
    const data: unknown = client.data;

    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Socket data must be an object.');
    }

    return data as Record<string, unknown>;
  }

  private extractToken(client: Socket): string | null {
    const auth: unknown = client.handshake.auth;

    const authToken =
      auth !== null &&
      typeof auth === 'object' &&
      !Array.isArray(auth) &&
      'token' in auth
        ? auth.token
        : undefined;

    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return this.stripBearer(authToken);
    }

    const queryToken = client.handshake.query.token;

    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return this.stripBearer(queryToken);
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization === 'string' && authorization.trim().length > 0) {
      return this.stripBearer(authorization);
    }

    return null;
  }

  private stripBearer(token: string): string {
    const normalized = token.trim();

    if (normalized.toLowerCase().startsWith('bearer ')) {
      return normalized.slice(7).trim();
    }

    return normalized;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    const secret = this.resolveJwtSecret();

    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret,
    });
  }

  private resolveJwtSecret(): string {
    const candidates = ['JWT_ACCESS_SECRET', 'JWT_SECRET', 'AUTH_JWT_SECRET'];

    for (const key of candidates) {
      const value = this.configService.get<string>(key);

      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    throw new Error('JWT secret برای WebSocket Notification تنظیم نشده است.');
  }

  private extractUserId(payload: JwtPayload): string | null {
    const candidates = [payload.sub, payload.userId, payload.id];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private async assertActiveUserExists(userId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "User" u
          WHERE
            u."id" = ${userId}
            AND u."deleted_at" IS NULL
            AND u."status"::text <> 'DELETED'
          LIMIT 1
        `,
    );

    if ((rows[0]?.count ?? 0) < 1) {
      throw new Error('کاربر WebSocket معتبر نیست.');
    }
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
