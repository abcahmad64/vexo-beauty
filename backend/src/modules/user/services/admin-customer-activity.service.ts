import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AdminUserService } from './admin-user.service';

type ActivityRow = {
  readonly source: string;
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string | null;
  readonly amount: Prisma.Decimal | number | string | null;
  readonly currency: string | null;
  readonly occurredAt: Date;
};

@Injectable()
export class AdminCustomerActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminUserService: AdminUserService,
  ) {}

  async getActivity(userId: string, limit = 50): Promise<unknown> {
    await this.adminUserService.findUserRow(userId, true);

    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    const now = new Date();

    const rows = await this.prisma.$queryRaw<ActivityRow[]>(
      Prisma.sql`
        SELECT *
        FROM (
          SELECT
            'user'::text AS "source",
            u."id" AS "id",
            'ثبت‌نام کاربر'::text AS "title",
            COALESCE(u."email", u."phone") AS "description",
            u."status"::text AS "status",
            NULL::numeric AS "amount",
            NULL::text AS "currency",
            u."createdAt" AS "occurredAt"
          FROM "User" u
          WHERE u."id" = ${userId}

          UNION ALL

          SELECT
            'order'::text AS "source",
            o."id" AS "id",
            CONCAT('سفارش ', o."orderNumber") AS "title",
            o."status"::text AS "description",
            o."paymentStatus"::text AS "status",
            o."totalAmount" AS "amount",
            o."currency" AS "currency",
            o."createdAt" AS "occurredAt"
          FROM "Order" o
          WHERE
            o."userId" = ${userId}
            AND o."deleted_at" IS NULL

          UNION ALL

          SELECT
            'payment'::text AS "source",
            p."id" AS "id",
            'پرداخت کاربر'::text AS "title",
            p."paymentMethod"::text AS "description",
            p."paymentStatus"::text AS "status",
            p."amount" AS "amount",
            p."currency" AS "currency",
            p."createdAt" AS "occurredAt"
          FROM "Payment" p
          WHERE
            p."userId" = ${userId}
            AND p."deleted_at" IS NULL

          UNION ALL

          SELECT
            'address'::text AS "source",
            a."id" AS "id",
            'آدرس کاربر'::text AS "title",
            CONCAT(a."city", ' - ', a."street") AS "description",
            CASE
              WHEN a."isDefault" = TRUE THEN 'DEFAULT'
              ELSE 'NORMAL'
            END AS "status",
            NULL::numeric AS "amount",
            NULL::text AS "currency",
            a."createdAt" AS "occurredAt"
          FROM "Address" a
          WHERE
            a."userId" = ${userId}
            AND a."deleted_at" IS NULL

          UNION ALL

          SELECT
            'session'::text AS "source",
            s."id" AS "id",
            'ورود یا نشست کاربر'::text AS "title",
            s."ipAddress" AS "description",
            CASE
              WHEN s."expiresAt" >= ${now} THEN 'ACTIVE'
              ELSE 'EXPIRED'
            END AS "status",
            NULL::numeric AS "amount",
            NULL::text AS "currency",
            s."createdAt" AS "occurredAt"
          FROM "UserSession" s
          WHERE
            s."userId" = ${userId}
            AND s."deleted_at" IS NULL

          UNION ALL

          SELECT
            'notification'::text AS "source",
            n."id" AS "id",
            n."title" AS "title",
            n."message" AS "description",
            n."type"::text AS "status",
            NULL::numeric AS "amount",
            NULL::text AS "currency",
            n."createdAt" AS "occurredAt"
          FROM "Notification" n
          WHERE
            n."userId" = ${userId}
            AND n."deleted_at" IS NULL
            AND n."isActive" = TRUE

          UNION ALL

          SELECT
            'event'::text AS "source",
            e."id" AS "id",
            e."name" AS "title",
            e."description" AS "description",
            e."category" AS "status",
            NULL::numeric AS "amount",
            NULL::text AS "currency",
            e."timestamp" AS "occurredAt"
          FROM "Event" e
          WHERE
            e."deleted_at" IS NULL
            AND (
              e."userId" = ${userId}
              OR e."data" #>> '{customerId}' = ${userId}
            )
        ) activity
        ORDER BY
          activity."occurredAt" DESC,
          activity."id" DESC
        LIMIT ${safeLimit}
      `,
    );

    return {
      data: rows.map((row) => ({
        source: row.source,
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        amount: row.amount === null ? null : this.toDecimalString(row.amount),
        currency: row.currency,
        occurredAt: row.occurredAt.toISOString(),
        occurredAtFa: formatPersianDateTime(row.occurredAt),
      })),
      meta: {
        userId,
        limit: safeLimit,
        total: rows.length,
      },
    };
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }
}
