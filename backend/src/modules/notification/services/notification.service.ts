import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { NotificationType, Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateNotificationDto } from '../dto/create-notification.dto';

import { MarkNotificationReadDto } from '../dto/mark-notification-read.dto';

import { QueryNotificationDto } from '../dto/query-notification.dto';

import { SendNotificationDto } from '../dto/send-notification.dto';

import { NotificationEventPublisher } from '../events/notification.event.publisher';

type CountRow = {
  count: number;
};

type NotificationChannel = 'database' | 'email' | 'sms' | 'push' | 'websocket';

type NotificationRow = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  linkUrl: string | null;
  metadata: Prisma.JsonValue | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type NotificationResponse = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: Date | null;
  readAtFa: string | null;
  linkUrl: string | null;
  actionUrl: string | null;
  metadata: Prisma.JsonValue | null;
  isActive: boolean;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  deletedAt: Date | null;
  deletedAtFa: string | null;
};

type NotificationListResponse = {
  data: NotificationResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type NotificationMutationOptions = {
  actorId?: string;
};

type SendNotificationResponse = {
  notification: NotificationResponse | null;
  channels: NotificationChannel[];
  savedToDatabase: boolean;
};

@Injectable()
export class NotificationService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventPublisher,
  ) {}

  async createNotification(
    dto: CreateNotificationDto,
    options: NotificationMutationOptions = {},
  ): Promise<NotificationResponse> {
    await this.assertActiveUserExists(dto.userId);

    const notificationType = this.normalizeNotificationType(dto.type);

    const isRead = dto.isRead === true;

    const now = new Date();

    const readAt = isRead ? now : null;

    const rows = await this.prisma.$queryRaw<NotificationRow[]>(
      Prisma.sql`
          INSERT INTO "Notification" (
            "id",
            "userId",
            "type",
            "title",
            "message",
            "isRead",
            "readAt",
            "linkUrl",
            "metadata",
            "isActive",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${dto.userId},
            ${notificationType}::"NotificationType",
            ${dto.title},
            ${dto.message},
            ${isRead},
            ${readAt},
            ${dto.actionUrl ?? null},
            ${this.toJsonb(dto.metadata)},
            TRUE,
            ${now},
            ${now}
          )
          RETURNING
            "id",
            "userId",
            "type",
            "title",
            "message",
            "isRead",
            "readAt",
            "linkUrl",
            "metadata",
            "isActive",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
        `,
    );

    const notification = this.requireNotification(rows);

    this.events.publishNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: this.toMetadataRecord(notification.metadata),
      actorId: options.actorId,
      isRead: notification.isRead,
      occurredAt: now,
    });

    if (dto.sendNow === true) {
      this.events.publishNotificationSent({
        notificationId: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: this.toMetadataRecord(notification.metadata),
        actorId: options.actorId,
        channel: 'database',
        occurredAt: now,
      });
    }

    return this.mapNotification(notification);
  }

  async sendNotification(
    dto: SendNotificationDto,
    options: NotificationMutationOptions = {},
  ): Promise<SendNotificationResponse> {
    const channels = this.normalizeChannels(dto.channels);

    const shouldSaveToDatabase =
      dto.saveToDatabase !== false || channels.includes('database');

    let notification: NotificationResponse | null = null;

    if (shouldSaveToDatabase) {
      notification = await this.createNotification(
        {
          userId: dto.userId,
          title: dto.title,
          message: dto.message,
          type: dto.type,
          metadata: dto.metadata,
          actionUrl: dto.actionUrl,
          isRead: false,
          sendNow: false,
        },
        options,
      );
    } else {
      await this.assertActiveUserExists(dto.userId);
    }

    const sentAt = new Date();

    const notificationId = notification?.id ?? `virtual:${sentAt.getTime()}`;

    for (const channel of channels) {
      this.events.publishNotificationSent({
        notificationId,
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: this.normalizeNotificationType(dto.type),
        metadata: dto.metadata ?? null,
        actorId: options.actorId,
        channel,
        occurredAt: sentAt,
      });
    }

    return {
      notification,
      channels,
      savedToDatabase: shouldSaveToDatabase,
    };
  }

  async findAllForAdmin(
    query: QueryNotificationDto,
  ): Promise<NotificationListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildAdminWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<NotificationRow[]>(
        Prisma.sql`
            SELECT
              n."id",
              n."userId",
              n."type",
              n."title",
              n."message",
              n."isRead",
              n."readAt",
              n."linkUrl",
              n."metadata",
              n."isActive",
              n."createdAt",
              n."updatedAt",
              n."deleted_at" AS "deletedAt"
            FROM "Notification" n
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              n."createdAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Notification" n
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: rows.map((row) => this.mapNotification(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllForUser(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<NotificationListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildUserWhere(userId, query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<NotificationRow[]>(
        Prisma.sql`
            SELECT
              n."id",
              n."userId",
              n."type",
              n."title",
              n."message",
              n."isRead",
              n."readAt",
              n."linkUrl",
              n."metadata",
              n."isActive",
              n."createdAt",
              n."updatedAt",
              n."deleted_at" AS "deletedAt"
            FROM "Notification" n
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              n."createdAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Notification" n
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: rows.map((row) => this.mapNotificationForCustomer(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCountForUser(userId: string): Promise<{
    count: number;
  }> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT
            COUNT(*)::int AS "count"
          FROM "Notification" n
          WHERE
            n."userId" = ${userId}
            AND n."isRead" = FALSE
            AND n."isActive" = TRUE
            AND n."deleted_at" IS NULL
        `,
    );

    return {
      count: rows[0]?.count ?? 0,
    };
  }

  async findOneForAdmin(
    notificationId: string,
    includeDeleted = false,
  ): Promise<NotificationResponse> {
    const notification = await this.findNotificationById(notificationId, {
      includeDeleted,
    });

    return this.mapNotification(notification);
  }

  async findOneForUser(
    userId: string,
    notificationId: string,
  ): Promise<NotificationResponse> {
    const notification = await this.findNotificationById(notificationId, {
      includeDeleted: false,
    });

    if (notification.userId !== userId) {
      throw new NotFoundException('اعلان موردنظر یافت نشد.');
    }

    return this.mapNotificationForCustomer(notification);
  }

  async markReadForUser(
    userId: string,
    notificationId: string,
    dto: MarkNotificationReadDto,
    options: NotificationMutationOptions = {},
  ): Promise<NotificationResponse> {
    const notification = await this.findNotificationById(notificationId, {
      includeDeleted: false,
    });

    if (notification.userId !== userId) {
      throw new NotFoundException('اعلان موردنظر یافت نشد.');
    }

    const updated = await this.updateReadState(notification, dto, {
      actorId: options.actorId ?? userId,
    });

    return this.toCustomerNotificationResponse(updated);
  }

  async markReadForAdmin(
    notificationId: string,
    dto: MarkNotificationReadDto,
    options: NotificationMutationOptions = {},
  ): Promise<NotificationResponse> {
    const notification = await this.findNotificationById(notificationId, {
      includeDeleted: false,
    });

    return this.updateReadState(notification, dto, options);
  }

  async markAllReadForUser(
    userId: string,
    options: NotificationMutationOptions = {},
  ): Promise<{
    success: true;
    count: number;
  }> {
    const now = new Date();

    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          WITH updated AS (
            UPDATE "Notification"
            SET
              "isRead" = TRUE,
              "readAt" = ${now},
              "updatedAt" = ${now}
            WHERE
              "userId" = ${userId}
              AND "isRead" = FALSE
              AND "isActive" = TRUE
              AND "deleted_at" IS NULL
            RETURNING "id"
          )
          SELECT
            COUNT(*)::int AS "count"
          FROM updated
        `,
    );

    const count = rows[0]?.count ?? 0;

    this.events.publishNotificationAllRead({
      userId,
      count,
      actorId: options.actorId ?? userId,
      occurredAt: now,
    });

    return {
      success: true,
      count,
    };
  }

  async markAllReadForAdmin(
    userId: string,
    options: NotificationMutationOptions = {},
  ): Promise<{
    success: true;
    count: number;
  }> {
    await this.assertActiveUserExists(userId);

    return this.markAllReadForUser(userId, options);
  }

  async deleteForUser(
    userId: string,
    notificationId: string,
    options: NotificationMutationOptions = {},
  ): Promise<{
    success: true;
  }> {
    const notification = await this.findNotificationById(notificationId, {
      includeDeleted: false,
    });

    if (notification.userId !== userId) {
      throw new NotFoundException('اعلان موردنظر یافت نشد.');
    }

    await this.softDeleteNotification(notification, {
      actorId: options.actorId ?? userId,
    });

    return {
      success: true,
    };
  }

  async deleteForAdmin(
    notificationId: string,
    options: NotificationMutationOptions = {},
  ): Promise<{
    success: true;
  }> {
    const notification = await this.findNotificationById(notificationId, {
      includeDeleted: false,
    });

    await this.softDeleteNotification(notification, options);

    return {
      success: true,
    };
  }

  async createOrderNotification(input: {
    userId: string;
    orderId: string;
    orderNumber?: string | null;
    title: string;
    message: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
    actorId?: string;
  }): Promise<NotificationResponse> {
    const notification = await this.createNotification(
      {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: NotificationType.ORDER_UPDATE,
        actionUrl: input.actionUrl ?? undefined,
        metadata: {
          ...(input.metadata ?? {}),
          orderId: input.orderId,
          orderNumber: input.orderNumber ?? null,
        },
        sendNow: true,
      },
      {
        actorId: input.actorId,
      },
    );

    const now = new Date();

    this.events.publishOrderNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: this.toMetadataRecord(notification.metadata),
      actorId: input.actorId,
      orderId: input.orderId,
      orderNumber: input.orderNumber ?? null,
      occurredAt: now,
    });

    return notification;
  }

  async createShipmentNotification(input: {
    userId: string;
    orderId: string;
    orderNumber?: string | null;
    trackingNumber?: string | null;
    title: string;
    message: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
    actorId?: string;
  }): Promise<NotificationResponse> {
    const notification = await this.createNotification(
      {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: NotificationType.ORDER_UPDATE,
        actionUrl: input.actionUrl ?? undefined,
        metadata: {
          ...(input.metadata ?? {}),
          orderId: input.orderId,
          orderNumber: input.orderNumber ?? null,
          trackingNumber: input.trackingNumber ?? null,
        },
        sendNow: true,
      },
      {
        actorId: input.actorId,
      },
    );

    this.events.publishShipmentNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: this.toMetadataRecord(notification.metadata),
      actorId: input.actorId,
      orderId: input.orderId,
      orderNumber: input.orderNumber ?? null,
      trackingNumber: input.trackingNumber ?? null,
      occurredAt: new Date(),
    });

    return notification;
  }

  async createPaymentNotification(input: {
    userId: string;
    paymentId: string;
    orderId?: string | null;
    transactionId?: string | null;
    title: string;
    message: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
    actorId?: string;
  }): Promise<NotificationResponse> {
    const notification = await this.createNotification(
      {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: NotificationType.ORDER_UPDATE,
        actionUrl: input.actionUrl ?? undefined,
        metadata: {
          ...(input.metadata ?? {}),
          paymentId: input.paymentId,
          orderId: input.orderId ?? null,
          transactionId: input.transactionId ?? null,
        },
        sendNow: true,
      },
      {
        actorId: input.actorId,
      },
    );

    this.events.publishPaymentNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: this.toMetadataRecord(notification.metadata),
      actorId: input.actorId,
      paymentId: input.paymentId,
      orderId: input.orderId ?? null,
      transactionId: input.transactionId ?? null,
      occurredAt: new Date(),
    });

    return notification;
  }

  async createRefundNotification(input: {
    userId: string;
    refundId: string;
    paymentId?: string | null;
    orderId?: string | null;
    title: string;
    message: string;
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
    actorId?: string;
  }): Promise<NotificationResponse> {
    const notification = await this.createNotification(
      {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: NotificationType.ORDER_UPDATE,
        actionUrl: input.actionUrl ?? undefined,
        metadata: {
          ...(input.metadata ?? {}),
          refundId: input.refundId,
          paymentId: input.paymentId ?? null,
          orderId: input.orderId ?? null,
        },
        sendNow: true,
      },
      {
        actorId: input.actorId,
      },
    );

    this.events.publishRefundNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: this.toMetadataRecord(notification.metadata),
      actorId: input.actorId,
      refundId: input.refundId,
      paymentId: input.paymentId ?? null,
      orderId: input.orderId ?? null,
      occurredAt: new Date(),
    });

    return notification;
  }

  async createSystemNotification(input: {
    userId: string;
    title: string;
    message: string;
    severity?: 'info' | 'success' | 'warning' | 'error';
    actionUrl?: string | null;
    metadata?: Record<string, unknown>;
    actorId?: string;
  }): Promise<NotificationResponse> {
    const notification = await this.createNotification(
      {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: NotificationType.SYSTEM,
        actionUrl: input.actionUrl ?? undefined,
        metadata: {
          ...(input.metadata ?? {}),
          severity: input.severity ?? 'info',
        },
        sendNow: true,
      },
      {
        actorId: input.actorId,
      },
    );

    this.events.publishSystemNotificationCreated({
      notificationId: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      metadata: this.toMetadataRecord(notification.metadata),
      actorId: input.actorId,
      severity: input.severity ?? 'info',
      occurredAt: new Date(),
    });

    return notification;
  }

  private async updateReadState(
    current: NotificationRow,
    dto: MarkNotificationReadDto,
    options: NotificationMutationOptions = {},
  ): Promise<NotificationResponse> {
    const now = new Date();

    const nextIsRead = dto.isRead ?? true;

    const nextReadAt = nextIsRead ? (current.readAt ?? now) : null;

    const rows = await this.prisma.$queryRaw<NotificationRow[]>(
      Prisma.sql`
          UPDATE "Notification"
          SET
            "isRead" = ${nextIsRead},
            "readAt" = ${nextReadAt},
            "updatedAt" = ${now}
          WHERE
            "id" = ${current.id}
            AND "deleted_at" IS NULL
          RETURNING
            "id",
            "userId",
            "type",
            "title",
            "message",
            "isRead",
            "readAt",
            "linkUrl",
            "metadata",
            "isActive",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
        `,
    );

    const updated = this.requireNotification(rows);

    if (nextIsRead) {
      this.events.publishNotificationRead({
        notificationId: updated.id,
        userId: updated.userId,
        readAt: updated.readAt ?? now,
        actorId: options.actorId,
        occurredAt: now,
      });
    }

    return this.mapNotification(updated);
  }

  private async softDeleteNotification(
    notification: NotificationRow,
    options: NotificationMutationOptions = {},
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Notification"
        SET
          "isActive" = FALSE,
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "id" = ${notification.id}
          AND "deleted_at" IS NULL
      `,
    );

    this.events.publishNotificationDeleted({
      notificationId: notification.id,
      userId: notification.userId,
      actorId: options.actorId,
      occurredAt: now,
    });
  }

  private async findNotificationById(
    notificationId: string,
    options: {
      includeDeleted: boolean;
    },
  ): Promise<NotificationRow> {
    const deletedCondition = options.includeDeleted
      ? Prisma.sql`TRUE`
      : Prisma.sql`n."deleted_at" IS NULL`;

    const rows = await this.prisma.$queryRaw<NotificationRow[]>(
      Prisma.sql`
          SELECT
            n."id",
            n."userId",
            n."type",
            n."title",
            n."message",
            n."isRead",
            n."readAt",
            n."linkUrl",
            n."metadata",
            n."isActive",
            n."createdAt",
            n."updatedAt",
            n."deleted_at" AS "deletedAt"
          FROM "Notification" n
          WHERE
            n."id" = ${notificationId}
            AND ${deletedCondition}
          LIMIT 1
        `,
    );

    const notification = rows[0];

    if (!notification) {
      throw new NotFoundException('اعلان موردنظر یافت نشد.');
    }

    return notification;
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
      throw new NotFoundException('کاربر موردنظر یافت نشد.');
    }
  }

  private buildAdminWhere(query: QueryNotificationDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [];

    if (query.includeDeleted) {
      where.push(Prisma.sql`TRUE`);
    } else {
      where.push(
        Prisma.sql`
          n."deleted_at" IS NULL
          AND n."isActive" = TRUE
        `,
      );
    }

    this.pushSharedFilters(where, query);

    if (query.userId) {
      where.push(Prisma.sql`n."userId" = ${query.userId}`);
    }

    return where;
  }

  private buildUserWhere(
    userId: string,
    query: QueryNotificationDto,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`n."userId" = ${userId}`,
      Prisma.sql`n."deleted_at" IS NULL`,
      Prisma.sql`n."isActive" = TRUE`,
    ];

    this.pushSharedFilters(where, query);

    return where;
  }

  private pushSharedFilters(
    where: Prisma.Sql[],
    query: QueryNotificationDto,
  ): void {
    if (query.q) {
      where.push(
        Prisma.sql`
          (
            n."title" ILIKE ${`%${query.q}%`}
            OR n."message" ILIKE ${`%${query.q}%`}
          )
        `,
      );
    }

    if (query.type) {
      where.push(
        Prisma.sql`
          n."type" = ${this.normalizeNotificationType(query.type)}::"NotificationType"
        `,
      );
    }

    if (query.isRead !== undefined) {
      where.push(Prisma.sql`n."isRead" = ${query.isRead}`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`n."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`n."createdAt" <= ${new Date(query.createdTo)}`);
    }
  }

  private normalizeNotificationType(type: string): NotificationType {
    const normalized = type.trim().toUpperCase();

    const values = Object.values(NotificationType);

    if (!values.includes(normalized as NotificationType)) {
      throw new BadRequestException(`نوع اعلان نامعتبر است: ${type}`);
    }

    return normalized as NotificationType;
  }

  private normalizeChannels(
    channels?: NotificationChannel[],
  ): NotificationChannel[] {
    if (!channels || channels.length < 1) {
      return ['database'];
    }

    return Array.from(new Set(channels));
  }

  private normalizePage(page?: number): number {
    if (!page || page < 1) {
      return this.defaultPage;
    }

    return page;
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit < 1) {
      return this.defaultLimit;
    }

    return Math.min(limit, this.maxLimit);
  }

  private toJsonb(value?: Record<string, unknown>): Prisma.Sql {
    if (value === undefined || value === null) {
      return Prisma.sql`NULL`;
    }

    return Prisma.sql`${JSON.stringify(value)}::jsonb`;
  }

  private toMetadataRecord(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value;
  }

  private requireNotification(rows: NotificationRow[]): NotificationRow {
    const notification = rows[0];

    if (!notification) {
      throw new NotFoundException('اعلان موردنظر یافت نشد.');
    }

    return notification;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private mapNotificationForCustomer(
    row: NotificationRow,
  ): NotificationResponse {
    return this.toCustomerNotificationResponse(this.mapNotification(row));
  }

  private toCustomerNotificationResponse(
    notification: NotificationResponse,
  ): NotificationResponse {
    return {
      ...notification,
      metadata: null,
    };
  }

  private mapNotification(row: NotificationRow): NotificationResponse {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      isRead: row.isRead,
      readAt: row.readAt,
      readAtFa: this.toPersianDateTimeString(row.readAt),
      linkUrl: row.linkUrl,
      actionUrl: row.linkUrl,
      metadata: row.metadata,
      isActive: row.isActive,
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
    };
  }
}
