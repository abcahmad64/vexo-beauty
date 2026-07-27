import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { AdminUserService } from './admin-user.service';

type AddressRow = {
  id: string;
  title: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string | null;
  city: string;
  postalCode: string | null;
  street: string;
  apartment: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: Prisma.Decimal | number | string;
  currency: string;
  createdAt: Date;
};

type PaymentRow = {
  id: string;
  orderId: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  paidAt: Date | null;
  createdAt: Date;
};

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
};

type NoteRow = {
  id: string;
  userId: string | null;
  data: Prisma.JsonValue | null;
  timestamp: Date;
};

@Injectable()
export class AdminCustomerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminUserService: AdminUserService,
  ) {}

  async getProfile(userId: string): Promise<unknown> {
    const user = await this.adminUserService.findOne(userId);

    const [addresses, orders, payments, sessions, notes, segment] =
      await Promise.all([
        this.getAddresses(userId),
        this.getRecentOrders(userId),
        this.getRecentPayments(userId),
        this.getRecentSessions(userId),
        this.getNotes(userId, 20),
        this.getSegment(userId),
      ]);

    return {
      user,
      segment,
      addresses: addresses.map((row) => ({
        id: row.id,
        title: row.title,
        firstName: row.firstName,
        lastName: row.lastName,
        fullName: `${row.firstName} ${row.lastName}`.trim(),
        phone: row.phone,
        country: row.country,
        state: row.state,
        city: row.city,
        postalCode: row.postalCode,
        street: row.street,
        apartment: row.apartment,
        isDefault: row.isDefault,
        createdAt: row.createdAt.toISOString(),
        createdAtFa: formatPersianDateTime(row.createdAt),
        updatedAt: row.updatedAt.toISOString(),
        updatedAtFa: formatPersianDateTime(row.updatedAt),
      })),
      recentOrders: orders.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalAmount: this.toDecimalString(row.totalAmount),
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
        createdAtFa: formatPersianDateTime(row.createdAt),
      })),
      recentPayments: payments.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        amount: this.toDecimalString(row.amount),
        currency: row.currency,
        paymentMethod: row.paymentMethod,
        paymentStatus: row.paymentStatus,
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
        paidAtFa: formatPersianDateTime(row.paidAt),
        createdAt: row.createdAt.toISOString(),
        createdAtFa: formatPersianDateTime(row.createdAt),
      })),
      recentSessions: sessions.map((row) => ({
        id: row.id,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        expiresAt: row.expiresAt.toISOString(),
        expiresAtFa: formatPersianDateTime(row.expiresAt),
        createdAt: row.createdAt.toISOString(),
        createdAtFa: formatPersianDateTime(row.createdAt),
      })),
      notes: notes.map((row) => this.mapNote(row)),
    };
  }

  async getNotes(userId: string, limit = 50): Promise<NoteRow[]> {
    await this.adminUserService.findUserRow(userId, true);

    return this.prisma.$queryRaw<NoteRow[]>(
      Prisma.sql`
        SELECT
          e."id",
          e."userId",
          e."data",
          e."timestamp"
        FROM "Event" e
        WHERE
          e."deleted_at" IS NULL
          AND e."name" = 'customer.note.created'
          AND e."data" #>> '{customerId}' = ${userId}
        ORDER BY
          e."timestamp" DESC,
          e."createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  async getSegment(userId: string): Promise<unknown> {
    await this.adminUserService.findUserRow(userId, true);

    const rows = await this.prisma.$queryRaw<NoteRow[]>(
      Prisma.sql`
          SELECT
            e."id",
            e."userId",
            e."data",
            e."timestamp"
          FROM "Event" e
          WHERE
            e."deleted_at" IS NULL
            AND e."name" = 'customer.segment.updated'
            AND e."data" #>> '{customerId}' = ${userId}
          ORDER BY
            e."timestamp" DESC,
            e."createdAt" DESC
          LIMIT 1
        `,
    );

    const row = rows[0] ?? null;

    const data = this.toRecord(row?.data ?? null);

    return {
      segment: data.segment ?? null,
      vipLevel: data.vipLevel ?? 'none',
      tags: Array.isArray(data.tags) ? data.tags : [],
      marketingAllowed: data.marketingAllowed ?? null,
      highRisk: data.highRisk ?? false,
      reason: data.reason ?? null,
      updatedAt: row ? row.timestamp.toISOString() : null,
      updatedAtFa: formatPersianDateTime(row?.timestamp ?? null),
    };
  }

  private getAddresses(userId: string): Promise<AddressRow[]> {
    return this.prisma.$queryRaw<AddressRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "title",
          "firstName",
          "lastName",
          "phone",
          "country",
          "state",
          "city",
          "postalCode",
          "street",
          "apartment",
          "isDefault",
          "createdAt",
          "updatedAt"
        FROM "Address"
        WHERE
          "userId" = ${userId}
          AND "deleted_at" IS NULL
        ORDER BY
          "isDefault" DESC,
          "createdAt" DESC
      `,
    );
  }

  private getRecentOrders(userId: string): Promise<OrderRow[]> {
    return this.prisma.$queryRaw<OrderRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "orderNumber",
          "status"::text AS "status",
          "paymentStatus"::text AS "paymentStatus",
          "totalAmount",
          "currency",
          "createdAt"
        FROM "Order"
        WHERE
          "userId" = ${userId}
          AND "deleted_at" IS NULL
        ORDER BY
          "createdAt" DESC
        LIMIT 10
      `,
    );
  }

  private getRecentPayments(userId: string): Promise<PaymentRow[]> {
    return this.prisma.$queryRaw<PaymentRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "orderId",
          "amount",
          "currency",
          "paymentMethod"::text AS "paymentMethod",
          "paymentStatus"::text AS "paymentStatus",
          "paidAt",
          "createdAt"
        FROM "Payment"
        WHERE
          "userId" = ${userId}
          AND "deleted_at" IS NULL
        ORDER BY
          "createdAt" DESC
        LIMIT 10
      `,
    );
  }

  private getRecentSessions(userId: string): Promise<SessionRow[]> {
    return this.prisma.$queryRaw<SessionRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "userAgent",
          "ipAddress",
          "expiresAt",
          "createdAt"
        FROM "UserSession"
        WHERE
          "userId" = ${userId}
          AND "deleted_at" IS NULL
        ORDER BY
          "createdAt" DESC
        LIMIT 10
      `,
    );
  }

  private mapNote(row: NoteRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      note: data.note ?? null,
      isImportant: data.isImportant ?? false,
      visibility: data.visibility ?? 'admin',
      actorId: row.userId,
      createdAt: row.timestamp.toISOString(),
      createdAtFa: formatPersianDateTime(row.timestamp),
    };
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }
}
