import { Injectable, NotFoundException } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { DeletePushSubscriptionDto } from '../dto/delete-push-subscription.dto';

import { RegisterPushSubscriptionDto } from '../dto/register-push-subscription.dto';

type PushSubscriptionRow = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  ipAddress: string | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type PushSubscriptionResponse = {
  id: string;
  userId: string;
  endpoint: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  lastUsedAtFa: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
};

@Injectable()
export class PushSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    userId: string,
    dto: RegisterPushSubscriptionDto,
    meta: {
      readonly ipAddress?: string;
      readonly userAgent?: string;
    } = {},
  ): Promise<PushSubscriptionResponse> {
    const now = new Date();

    const rows = await this.prisma.$queryRaw<PushSubscriptionRow[]>(
      Prisma.sql`
          INSERT INTO "PushSubscription" (
            "id",
            "userId",
            "endpoint",
            "p256dh",
            "auth",
            "userAgent",
            "ipAddress",
            "isActive",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${randomUUID()},
            ${userId},
            ${dto.endpoint},
            ${dto.keys.p256dh},
            ${dto.keys.auth},
            ${dto.userAgent ?? meta.userAgent ?? null},
            ${meta.ipAddress ?? null},
            TRUE,
            ${now},
            ${now}
          )
          ON CONFLICT ("endpoint")
          DO UPDATE SET
            "userId" = EXCLUDED."userId",
            "p256dh" = EXCLUDED."p256dh",
            "auth" = EXCLUDED."auth",
            "userAgent" = EXCLUDED."userAgent",
            "ipAddress" = EXCLUDED."ipAddress",
            "isActive" = TRUE,
            "deleted_at" = NULL,
            "updatedAt" = ${now}
          RETURNING
            "id",
            "userId",
            "endpoint",
            "p256dh",
            "auth",
            "userAgent",
            "ipAddress",
            "isActive",
            "lastUsedAt",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
        `,
    );

    return this.mapRow(this.requireRow(rows));
  }

  async deleteForUser(
    userId: string,
    dto: DeletePushSubscriptionDto,
  ): Promise<{
    success: true;
  }> {
    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "PushSubscription"
        SET
          "isActive" = FALSE,
          "deleted_at" = ${now},
          "updatedAt" = ${now}
        WHERE
          "userId" = ${userId}
          AND "endpoint" = ${dto.endpoint}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      success: true,
    };
  }

  async findAllForUser(userId: string): Promise<PushSubscriptionResponse[]> {
    const rows = await this.prisma.$queryRaw<PushSubscriptionRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "userId",
            "endpoint",
            "p256dh",
            "auth",
            "userAgent",
            "ipAddress",
            "isActive",
            "lastUsedAt",
            "createdAt",
            "updatedAt",
            "deleted_at" AS "deletedAt"
          FROM "PushSubscription"
          WHERE
            "userId" = ${userId}
            AND "isActive" = TRUE
            AND "deleted_at" IS NULL
          ORDER BY
            "updatedAt" DESC
        `,
    );

    return rows.map((row) => this.mapRow(row));
  }

  private requireRow(rows: PushSubscriptionRow[]): PushSubscriptionRow {
    const row = rows[0];

    if (!row) {
      throw new NotFoundException('اشتراک Push یافت نشد.');
    }

    return row;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private mapRow(row: PushSubscriptionRow): PushSubscriptionResponse {
    return {
      id: row.id,
      userId: row.userId,
      endpoint: row.endpoint,
      isActive: row.isActive,
      lastUsedAt: row.lastUsedAt,
      lastUsedAtFa: this.toPersianDateTimeString(row.lastUsedAt),
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
    };
  }
}
