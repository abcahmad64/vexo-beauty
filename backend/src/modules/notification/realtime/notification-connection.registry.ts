import { Injectable } from '@nestjs/common';

type ConnectionRecord = {
  readonly socketId: string;
  readonly userId: string;
  readonly connectedAt: Date;
};

@Injectable()
export class NotificationConnectionRegistry {
  private readonly socketToConnection = new Map<string, ConnectionRecord>();

  private readonly userToSockets = new Map<string, Set<string>>();

  register(socketId: string, userId: string): void {
    this.socketToConnection.set(socketId, {
      socketId,
      userId,
      connectedAt: new Date(),
    });

    const sockets = this.userToSockets.get(userId) ?? new Set<string>();

    sockets.add(socketId);

    this.userToSockets.set(userId, sockets);
  }

  unregister(socketId: string): void {
    const connection = this.socketToConnection.get(socketId);

    if (!connection) {
      return;
    }

    this.socketToConnection.delete(socketId);

    const sockets = this.userToSockets.get(connection.userId);

    if (!sockets) {
      return;
    }

    sockets.delete(socketId);

    if (sockets.size < 1) {
      this.userToSockets.delete(connection.userId);
    }
  }

  getSocketIdsForUser(userId: string): string[] {
    return Array.from(this.userToSockets.get(userId) ?? []);
  }

  countUserConnections(userId: string): number {
    return this.getSocketIdsForUser(userId).length;
  }

  countAllConnections(): number {
    return this.socketToConnection.size;
  }
}
