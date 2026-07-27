import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminOrderNoteDto } from '../dto/admin-order-note.dto';

import { AdminQueryOrderDto } from '../dto/admin-query-order.dto';

import { AdminUpdateOrderDto } from '../dto/admin-update-order.dto';

import { AdminUpdateOrderPaymentStatusDto } from '../dto/admin-update-order-payment-status.dto';

import { AdminUpdateOrderStatusDto } from '../dto/admin-update-order-status.dto';

type CountRow = {
  count: number | bigint;
};

type OrderRow = {
  id: string;
  userId: string;
  orderNumber: string;
  status: string;
  subtotal: Prisma.Decimal | number | string;
  taxAmount: Prisma.Decimal | number | string;
  shippingAmount: Prisma.Decimal | number | string;
  discountAmount: Prisma.Decimal | number | string;
  totalAmount: Prisma.Decimal | number | string;
  currency: string;
  paymentStatus: string;
  paymentMethod: string | null;
  shippingAddressId: string | null;
  billingAddressId: string | null;
  shippingMethod: string | null;
  trackingNumber: string | null;
  notes: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  itemCount: number | bigint;
  totalQuantity: number | bigint;
  paidAmount: Prisma.Decimal | number | string | null;
  refundedAmount: Prisma.Decimal | number | string | null;
  netPaidAmount: Prisma.Decimal | number | string | null;
  failedPaymentCount: number | bigint;
  invoiceId: string | null;
  invoiceStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type OrderItemRow = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number | bigint;
  price: Prisma.Decimal | number | string;
  productName: string;
  sku: string;
  discount: Prisma.Decimal | number | string;
  createdAt: Date;
};

type PaymentRow = {
  id: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionId: string | null;
  gateway: string | null;
  receiptUrl: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
};

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
};

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  userId: string | null;
  data: Prisma.JsonValue | null;
  timestamp: Date;
  createdAt: Date;
};

@Injectable()
export class AdminOrderService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryOrderDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildOrderWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<OrderRow[]>(
        Prisma.sql`
            SELECT
              o."id",
              o."userId",
              o."orderNumber",
              o."status"::text AS "status",
              o."subtotal",
              o."taxAmount",
              o."shippingAmount",
              o."discountAmount",
              o."totalAmount",
              o."currency",
              o."paymentStatus"::text AS "paymentStatus",
              o."paymentMethod"::text AS "paymentMethod",
              o."shippingAddressId",
              o."billingAddressId",
              o."shippingMethod",
              o."trackingNumber",
              o."notes",
              o."shippedAt",
              o."deliveredAt",
              o."cancelledAt",
              u."email" AS "userEmail",
              u."phone" AS "userPhone",
              u."firstName" AS "userFirstName",
              u."lastName" AS "userLastName",
              COALESCE(stats."itemCount", 0)::int AS "itemCount",
              COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity",
              COALESCE(stats."paidAmount", 0)::numeric AS "paidAmount",
              COALESCE(stats."refundedAmount", 0)::numeric AS "refundedAmount",
              GREATEST(
                COALESCE(stats."paidAmount", 0) -
                COALESCE(stats."refundedAmount", 0),
                0
              )::numeric AS "netPaidAmount",
              COALESCE(stats."failedPaymentCount", 0)::int AS "failedPaymentCount",
              invoice."id" AS "invoiceId",
              invoice."status"::text AS "invoiceStatus",
              o."createdAt",
              o."updatedAt",
              o."deleted_at" AS "deletedAt"
            FROM "Order" o
            LEFT JOIN "User" u
              ON u."id" = o."userId"
            LEFT JOIN "Invoice" invoice
              ON invoice."orderId" = o."id"
              AND invoice."deleted_at" IS NULL
            LEFT JOIN LATERAL (
              SELECT
                (
                  SELECT COUNT(*)::int
                  FROM "OrderItem" oi
                  WHERE oi."orderId" = o."id"
                ) AS "itemCount",
                (
                  SELECT COALESCE(SUM(oi."quantity"), 0)::int
                  FROM "OrderItem" oi
                  WHERE oi."orderId" = o."id"
                ) AS "totalQuantity",
                (
                  SELECT COALESCE(SUM(p."amount"), 0)::numeric
                  FROM "Payment" p
                  WHERE
                    p."orderId" = o."id"
                    AND p."deleted_at" IS NULL
                    AND p."paymentStatus"::text IN (
                      'COMPLETED',
                      'PARTIAL_REFUNDED',
                      'REFUNDED'
                    )
                ) AS "paidAmount",
                (
                  SELECT COALESCE(SUM(r."amount"), 0)::numeric
                  FROM "Refund" r
                  INNER JOIN "Payment" rp
                    ON rp."id" = r."paymentId"
                  WHERE
                    rp."orderId" = o."id"
                    AND rp."deleted_at" IS NULL
                    AND r."deleted_at" IS NULL
                    AND r."status"::text = 'COMPLETED'
                ) AS "refundedAmount",
                (
                  SELECT COUNT(*)::int
                  FROM "Payment" p
                  WHERE
                    p."orderId" = o."id"
                    AND p."deleted_at" IS NULL
                    AND p."paymentStatus"::text = 'FAILED'
                ) AS "failedPaymentCount"
            ) stats ON TRUE
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              ${this.resolveSortColumn(query.sortBy)}
              ${this.resolveSortDirection(query.sortDirection)},
              o."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Order" o
            LEFT JOIN "User" u
              ON u."id" = o."userId"
            LEFT JOIN "Invoice" invoice
              ON invoice."orderId" = o."id"
              AND invoice."deleted_at" IS NULL
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = this.toNumber(countRows[0]?.count);

    return {
      data: rows.map((row) => this.mapOrder(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(orderId: string) {
    const order = await this.findOrderRow(orderId, true);

    const [items, payments, shippingAddress, billingAddress, notes] =
      await Promise.all([
        this.findOrderItems(orderId),
        this.findOrderPayments(orderId),
        order.shippingAddressId
          ? this.findAddress(order.shippingAddressId)
          : null,
        order.billingAddressId
          ? this.findAddress(order.billingAddressId)
          : null,
        this.findOrderNotes(orderId, 20),
      ]);

    return {
      ...this.mapOrder(order),
      items: items.map((item) => this.mapItem(item)),
      payments: payments.map((payment) => this.mapPayment(payment)),
      shippingAddress: shippingAddress
        ? this.mapAddress(shippingAddress)
        : null,
      billingAddress: billingAddress ? this.mapAddress(billingAddress) : null,
      notes: notes.map((note) => this.mapNote(note)),
    };
  }

  async update(orderId: string, dto: AdminUpdateOrderDto, actorId?: string) {
    await this.findOrderRow(orderId, false);

    if (dto.shippingAddressId) {
      await this.assertAddressExists(dto.shippingAddressId);
    }

    if (dto.billingAddressId) {
      await this.assertAddressExists(dto.billingAddressId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی سفارش ارسال نشده است.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'order.admin_updated',
      'اطلاعات سفارش توسط ادمین به‌روزرسانی شد.',
      orderId,
      actorId,
      {
        changedFields: Object.keys(dto),
      },
    );

    return {
      order: await this.findOne(orderId),
      audit: {
        actorId: actorId ?? null,
        action: 'order.admin_updated',
      },
    };
  }

  async updateStatus(
    orderId: string,
    dto: AdminUpdateOrderStatusDto,
    actorId?: string,
  ) {
    const current = await this.findOrderRow(orderId, false);

    const assignments: Prisma.Sql[] = [
      Prisma.sql`"status" = ${dto.status}::"OrderStatus"`,
    ];

    if (dto.status === 'SHIPPED' && current.shippedAt === null) {
      assignments.push(
        Prisma.sql`"shippedAt" = ${dto.shippedAt ? new Date(dto.shippedAt) : new Date()}`,
      );
    }

    if (dto.status === 'DELIVERED' && current.deliveredAt === null) {
      assignments.push(
        Prisma.sql`"deliveredAt" = ${dto.deliveredAt ? new Date(dto.deliveredAt) : new Date()}`,
      );
    }

    if (dto.status === 'CANCELLED' && current.cancelledAt === null) {
      assignments.push(Prisma.sql`"cancelledAt" = NOW()`);
    }

    if (dto.trackingNumber !== undefined) {
      assignments.push(Prisma.sql`"trackingNumber" = ${dto.trackingNumber}`);
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'order.status.updated',
      'وضعیت سفارش توسط ادمین تغییر کرد.',
      orderId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      order: await this.findOne(orderId),
      audit: {
        actorId: actorId ?? null,
        action: 'order.status_updated',
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    };
  }

  async updatePaymentStatus(
    orderId: string,
    dto: AdminUpdateOrderPaymentStatusDto,
    actorId?: string,
  ) {
    const current = await this.findOrderRow(orderId, false);

    const assignments: Prisma.Sql[] = [
      Prisma.sql`"paymentStatus" = ${dto.paymentStatus}::"PaymentStatus"`,
    ];

    if (dto.paymentMethod !== undefined) {
      assignments.push(
        Prisma.sql`"paymentMethod" = ${dto.paymentMethod}::"PaymentMethod"`,
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = NOW()
        WHERE
          "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'order.payment_status.updated',
      'وضعیت پرداخت سفارش توسط ادمین تغییر کرد.',
      orderId,
      actorId,
      {
        previousPaymentStatus: current.paymentStatus,
        currentPaymentStatus: dto.paymentStatus,
        paymentMethod: dto.paymentMethod ?? current.paymentMethod,
        reason: dto.reason ?? null,
      },
    );

    return {
      order: await this.findOne(orderId),
      audit: {
        actorId: actorId ?? null,
        action: 'order.payment_status_updated',
        previousPaymentStatus: current.paymentStatus,
        currentPaymentStatus: dto.paymentStatus,
        reason: dto.reason ?? null,
      },
    };
  }

  async delete(orderId: string, actorId?: string) {
    await this.findOrderRow(orderId, false);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE
          "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    await this.createSystemEvent(
      'order.admin_deleted',
      'سفارش توسط ادمین حذف نرم شد.',
      orderId,
      actorId,
      {},
    );

    return {
      success: true,
      message: 'سفارش با موفقیت حذف شد.',
      audit: {
        actorId: actorId ?? null,
        action: 'order.admin_deleted',
      },
    };
  }

  async restore(orderId: string, actorId?: string) {
    await this.findOrderRow(orderId, true);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          "deleted_at" = NULL,
          "updatedAt" = NOW()
        WHERE "id" = ${orderId}
      `,
    );

    await this.createSystemEvent(
      'order.admin_restored',
      'سفارش حذف‌شده توسط ادمین بازگردانی شد.',
      orderId,
      actorId,
      {},
    );

    return {
      order: await this.findOne(orderId),
      audit: {
        actorId: actorId ?? null,
        action: 'order.admin_restored',
      },
    };
  }

  async createNote(orderId: string, dto: AdminOrderNoteDto, actorId?: string) {
    await this.findOrderRow(orderId, true);

    const noteId = await this.createSystemEvent(
      'order.note.created',
      'یادداشت مدیریتی برای سفارش ثبت شد.',
      orderId,
      actorId,
      {
        note: dto.note,
        isImportant: dto.isImportant ?? false,
        visibility: dto.visibility ?? 'admin',
      },
    );

    return {
      success: true,
      noteId,
      message: 'یادداشت سفارش با موفقیت ثبت شد.',
    };
  }

  async getNotes(orderId: string, limit = 50) {
    await this.findOrderRow(orderId, true);

    const notes = await this.findOrderNotes(orderId, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        orderId,
        total: notes.length,
      },
    };
  }

  async getTimeline(orderId: string, limit = 100) {
    await this.findOrderRow(orderId, true);

    const safeLimit = Math.min(Math.max(limit, 1), 300);

    const rows = await this.prisma.$queryRaw<
      Array<{
        source: string;
        id: string;
        title: string;
        description: string | null;
        status: string | null;
        amount: Prisma.Decimal | number | string | null;
        currency: string | null;
        occurredAt: Date;
      }>
    >(
      Prisma.sql`
          SELECT *
          FROM (
            SELECT
              'order'::text AS "source",
              o."id" AS "id",
              CONCAT('سفارش ', o."orderNumber") AS "title",
              o."notes" AS "description",
              o."status"::text AS "status",
              o."totalAmount" AS "amount",
              o."currency" AS "currency",
              o."createdAt" AS "occurredAt"
            FROM "Order" o
            WHERE o."id" = ${orderId}

            UNION ALL

            SELECT
              'payment'::text AS "source",
              p."id" AS "id",
              'پرداخت سفارش'::text AS "title",
              p."paymentMethod"::text AS "description",
              p."paymentStatus"::text AS "status",
              p."amount" AS "amount",
              p."currency" AS "currency",
              p."createdAt" AS "occurredAt"
            FROM "Payment" p
            WHERE
              p."orderId" = ${orderId}
              AND p."deleted_at" IS NULL

            UNION ALL

            SELECT
              'refund'::text AS "source",
              r."id" AS "id",
              'بازگشت وجه سفارش'::text AS "title",
              r."reason" AS "description",
              r."status"::text AS "status",
              r."amount" AS "amount",
              p."currency" AS "currency",
              r."updatedAt" AS "occurredAt"
            FROM "Refund" r
            INNER JOIN "Payment" p
              ON p."id" = r."paymentId"
            WHERE
              p."orderId" = ${orderId}
              AND p."deleted_at" IS NULL
              AND r."deleted_at" IS NULL

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
              AND e."data" #>> '{orderId}' = ${orderId}
          ) timeline
          ORDER BY
            timeline."occurredAt" DESC,
            timeline."id" DESC
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
        occurredAtFa: this.toPersianDateTimeString(row.occurredAt),
      })),
      meta: {
        orderId,
        total: rows.length,
      },
    };
  }

  async findOrderRow(
    orderId: string,
    includeDeleted: boolean,
  ): Promise<OrderRow> {
    const where: Prisma.Sql[] = [Prisma.sql`o."id" = ${orderId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<OrderRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."userId",
            o."orderNumber",
            o."status"::text AS "status",
            o."subtotal",
            o."taxAmount",
            o."shippingAmount",
            o."discountAmount",
            o."totalAmount",
            o."currency",
            o."paymentStatus"::text AS "paymentStatus",
            o."paymentMethod"::text AS "paymentMethod",
            o."shippingAddressId",
            o."billingAddressId",
            o."shippingMethod",
            o."trackingNumber",
            o."notes",
            o."shippedAt",
            o."deliveredAt",
            o."cancelledAt",
            u."email" AS "userEmail",
            u."phone" AS "userPhone",
            u."firstName" AS "userFirstName",
            u."lastName" AS "userLastName",
            COALESCE(stats."itemCount", 0)::int AS "itemCount",
            COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity",
            COALESCE(stats."paidAmount", 0)::numeric AS "paidAmount",
            COALESCE(stats."refundedAmount", 0)::numeric AS "refundedAmount",
            GREATEST(
              COALESCE(stats."paidAmount", 0) -
              COALESCE(stats."refundedAmount", 0),
              0
            )::numeric AS "netPaidAmount",
            COALESCE(stats."failedPaymentCount", 0)::int AS "failedPaymentCount",
            invoice."id" AS "invoiceId",
            invoice."status"::text AS "invoiceStatus",
            o."createdAt",
            o."updatedAt",
            o."deleted_at" AS "deletedAt"
          FROM "Order" o
          LEFT JOIN "User" u
            ON u."id" = o."userId"
          LEFT JOIN "Invoice" invoice
            ON invoice."orderId" = o."id"
            AND invoice."deleted_at" IS NULL
          LEFT JOIN LATERAL (
            SELECT
              (
                SELECT COUNT(*)::int
                FROM "OrderItem" oi
                WHERE oi."orderId" = o."id"
              ) AS "itemCount",
              (
                SELECT COALESCE(SUM(oi."quantity"), 0)::int
                FROM "OrderItem" oi
                WHERE oi."orderId" = o."id"
              ) AS "totalQuantity",
              (
                SELECT COALESCE(SUM(p."amount"), 0)::numeric
                FROM "Payment" p
                WHERE
                  p."orderId" = o."id"
                  AND p."deleted_at" IS NULL
                  AND p."paymentStatus"::text IN (
                    'COMPLETED',
                    'PARTIAL_REFUNDED',
                    'REFUNDED'
                  )
              ) AS "paidAmount",
              (
                SELECT COALESCE(SUM(r."amount"), 0)::numeric
                FROM "Refund" r
                INNER JOIN "Payment" rp
                  ON rp."id" = r."paymentId"
                WHERE
                  rp."orderId" = o."id"
                  AND rp."deleted_at" IS NULL
                  AND r."deleted_at" IS NULL
                  AND r."status"::text = 'COMPLETED'
              ) AS "refundedAmount",
              (
                SELECT COUNT(*)::int
                FROM "Payment" p
                WHERE
                  p."orderId" = o."id"
                  AND p."deleted_at" IS NULL
                  AND p."paymentStatus"::text = 'FAILED'
              ) AS "failedPaymentCount"
          ) stats ON TRUE
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const order = rows[0];

    if (!order) {
      throw new NotFoundException('سفارش موردنظر پیدا نشد.');
    }

    return order;
  }

  private findOrderItems(orderId: string): Promise<OrderItemRow[]> {
    return this.prisma.$queryRaw<OrderItemRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "productId",
          "variantId",
          "quantity",
          "price",
          "productName",
          "sku",
          "discount",
          "createdAt"
        FROM "OrderItem"
        WHERE "orderId" = ${orderId}
        ORDER BY "createdAt" ASC, "id" ASC
      `,
    );
  }

  private findOrderPayments(orderId: string): Promise<PaymentRow[]> {
    return this.prisma.$queryRaw<PaymentRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "amount",
          "currency",
          "paymentMethod"::text AS "paymentMethod",
          "paymentStatus"::text AS "paymentStatus",
          "transactionId",
          "gateway",
          "receiptUrl",
          "paidAt",
          "refundedAt",
          "createdAt"
        FROM "Payment"
        WHERE
          "orderId" = ${orderId}
          AND "deleted_at" IS NULL
        ORDER BY "createdAt" DESC, "id" DESC
      `,
    );
  }

  private async findAddress(addressId: string): Promise<AddressRow | null> {
    const rows = await this.prisma.$queryRaw<AddressRow[]>(
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
            "apartment"
          FROM "Address"
          WHERE "id" = ${addressId}
          LIMIT 1
        `,
    );

    return rows[0] ?? null;
  }

  private findOrderNotes(orderId: string, limit: number): Promise<EventRow[]> {
    return this.prisma.$queryRaw<EventRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "name",
          "description",
          "category",
          "userId",
          "data",
          "timestamp",
          "createdAt"
        FROM "Event"
        WHERE
          "deleted_at" IS NULL
          AND "name" = 'order.note.created'
          AND "data" #>> '{orderId}' = ${orderId}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private buildOrderWhere(query: AdminQueryOrderDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          o."orderNumber" ILIKE ${`%${query.q}%`}
          OR o."trackingNumber" ILIKE ${`%${query.q}%`}
          OR o."notes" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
          OR u."firstName" ILIKE ${`%${query.q}%`}
          OR u."lastName" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.userId) {
      where.push(Prisma.sql`o."userId" = ${query.userId}`);
    }

    if (query.email) {
      where.push(Prisma.sql`u."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.orderNumber) {
      where.push(Prisma.sql`o."orderNumber" ILIKE ${`%${query.orderNumber}%`}`);
    }

    if (query.trackingNumber) {
      where.push(
        Prisma.sql`o."trackingNumber" ILIKE ${`%${query.trackingNumber}%`}`,
      );
    }

    if (query.status) {
      where.push(Prisma.sql`o."status"::text = ${query.status}`);
    }

    if (query.paymentStatus) {
      where.push(Prisma.sql`o."paymentStatus"::text = ${query.paymentStatus}`);
    }

    if (query.paymentMethod) {
      where.push(Prisma.sql`o."paymentMethod"::text = ${query.paymentMethod}`);
    }

    if (query.totalMin) {
      where.push(
        Prisma.sql`o."totalAmount" >= ${this.toDecimal(query.totalMin)}`,
      );
    }

    if (query.totalMax) {
      where.push(
        Prisma.sql`o."totalAmount" <= ${this.toDecimal(query.totalMax)}`,
      );
    }

    if (query.hasTrackingNumber === true) {
      where.push(Prisma.sql`o."trackingNumber" IS NOT NULL`);
    }

    if (query.hasTrackingNumber === false) {
      where.push(Prisma.sql`o."trackingNumber" IS NULL`);
    }

    if (query.hasInvoice === true) {
      where.push(Prisma.sql`invoice."id" IS NOT NULL`);
    }

    if (query.hasInvoice === false) {
      where.push(Prisma.sql`invoice."id" IS NULL`);
    }

    if (query.createdFrom) {
      where.push(Prisma.sql`o."createdAt" >= ${new Date(query.createdFrom)}`);
    }

    if (query.createdTo) {
      where.push(Prisma.sql`o."createdAt" <= ${new Date(query.createdTo)}`);
    }

    if (query.shippedFrom) {
      where.push(Prisma.sql`o."shippedAt" >= ${new Date(query.shippedFrom)}`);
    }

    if (query.shippedTo) {
      where.push(Prisma.sql`o."shippedAt" <= ${new Date(query.shippedTo)}`);
    }

    if (query.deliveredFrom) {
      where.push(
        Prisma.sql`o."deliveredAt" >= ${new Date(query.deliveredFrom)}`,
      );
    }

    if (query.deliveredTo) {
      where.push(Prisma.sql`o."deliveredAt" <= ${new Date(query.deliveredTo)}`);
    }

    return where;
  }

  private buildUpdateAssignments(dto: AdminUpdateOrderDto): Prisma.Sql[] {
    const assignments: Prisma.Sql[] = [];

    if (dto.shippingAddressId !== undefined) {
      assignments.push(
        Prisma.sql`"shippingAddressId" = ${dto.shippingAddressId}`,
      );
    }

    if (dto.billingAddressId !== undefined) {
      assignments.push(
        Prisma.sql`"billingAddressId" = ${dto.billingAddressId}`,
      );
    }

    if (dto.shippingMethod !== undefined) {
      assignments.push(Prisma.sql`"shippingMethod" = ${dto.shippingMethod}`);
    }

    if (dto.trackingNumber !== undefined) {
      assignments.push(Prisma.sql`"trackingNumber" = ${dto.trackingNumber}`);
    }

    if (dto.notes !== undefined) {
      assignments.push(Prisma.sql`"notes" = ${dto.notes}`);
    }

    return assignments;
  }

  private async assertAddressExists(addressId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS "count"
          FROM "Address"
          WHERE
            "id" = ${addressId}
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) < 1) {
      throw new BadRequestException('آدرس انتخاب‌شده معتبر نیست.');
    }
  }

  private async createSystemEvent(
    name: string,
    description: string,
    orderId: string,
    actorId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<string> {
    const eventId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "Event" (
          "id",
          "name",
          "description",
          "category",
          "timestamp",
          "userId",
          "data",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${eventId},
          ${name},
          ${description},
          'order',
          NOW(),
          ${actorId ?? null},
          ${JSON.stringify({
            orderId,
            ...data,
          })}::jsonb,
          NOW(),
          NOW()
        )
      `,
    );

    return eventId;
  }

  private mapOrder(row: OrderRow) {
    return {
      id: row.id,
      user: {
        id: row.userId,
        email: row.userEmail,
        phone: row.userPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        fullName: `${row.userFirstName ?? ''} ${row.userLastName ?? ''}`.trim(),
      },
      orderNumber: row.orderNumber,
      status: row.status,
      amounts: {
        subtotal: this.toDecimalString(row.subtotal),
        taxAmount: this.toDecimalString(row.taxAmount),
        shippingAmount: this.toDecimalString(row.shippingAmount),
        discountAmount: this.toDecimalString(row.discountAmount),
        totalAmount: this.toDecimalString(row.totalAmount),
        paidAmount: this.toDecimalString(row.paidAmount ?? 0),
        refundedAmount: this.toDecimalString(row.refundedAmount ?? 0),
        netPaidAmount: this.toDecimalString(row.netPaidAmount ?? 0),
        currency: row.currency,
      },
      payment: {
        status: row.paymentStatus,
        method: row.paymentMethod,
        failedPaymentCount: this.toNumber(row.failedPaymentCount),
      },
      shipping: {
        shippingAddressId: row.shippingAddressId,
        billingAddressId: row.billingAddressId,
        method: row.shippingMethod,
        trackingNumber: row.trackingNumber,
        shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
        shippedAtFa: this.toPersianDateTimeString(row.shippedAt),
        deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
        deliveredAtFa: this.toPersianDateTimeString(row.deliveredAt),
      },
      invoice: {
        id: row.invoiceId,
        status: row.invoiceStatus,
      },
      itemsSummary: {
        itemCount: this.toNumber(row.itemCount),
        totalQuantity: this.toNumber(row.totalQuantity),
      },
      notes: row.notes,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      cancelledAtFa: this.toPersianDateTimeString(row.cancelledAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt.toISOString(),
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
    };
  }

  private mapItem(row: OrderItemRow) {
    return {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      quantity: this.toNumber(row.quantity),
      price: this.toDecimalString(row.price),
      productName: row.productName,
      sku: row.sku,
      discount: this.toDecimalString(row.discount),
      lineTotal: this.toDecimalString(
        new Prisma.Decimal(row.price)
          .mul(this.toNumber(row.quantity))
          .minus(new Prisma.Decimal(row.discount)),
      ),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
    };
  }

  private mapPayment(row: PaymentRow) {
    return {
      id: row.id,
      amount: this.toDecimalString(row.amount),
      currency: row.currency,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      transactionId: row.transactionId,
      gateway: row.gateway,
      receiptUrl: row.receiptUrl,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      paidAtFa: this.toPersianDateTimeString(row.paidAt),
      refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
      refundedAtFa: this.toPersianDateTimeString(row.refundedAt),
      createdAt: row.createdAt.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
    };
  }

  private mapAddress(row: AddressRow) {
    return {
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
    };
  }

  private mapNote(row: EventRow) {
    const data = this.toRecord(row.data);

    return {
      id: row.id,
      note: data.note ?? null,
      isImportant: data.isImportant ?? false,
      visibility: data.visibility ?? 'admin',
      actorId: row.userId,
      createdAt: row.timestamp.toISOString(),
      createdAtFa: this.toPersianDateTimeString(row.timestamp),
    };
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private resolveSortColumn(sortBy?: string): Prisma.Sql {
    if (sortBy === 'updatedAt') {
      return Prisma.sql`o."updatedAt"`;
    }

    if (sortBy === 'orderNumber') {
      return Prisma.sql`o."orderNumber"`;
    }

    if (sortBy === 'status') {
      return Prisma.sql`o."status"`;
    }

    if (sortBy === 'paymentStatus') {
      return Prisma.sql`o."paymentStatus"`;
    }

    if (sortBy === 'totalAmount') {
      return Prisma.sql`o."totalAmount"`;
    }

    if (sortBy === 'userEmail') {
      return Prisma.sql`u."email"`;
    }

    if (sortBy === 'itemCount') {
      return Prisma.sql`stats."itemCount"`;
    }

    if (sortBy === 'paidAmount') {
      return Prisma.sql`stats."paidAmount"`;
    }

    if (sortBy === 'refundedAmount') {
      return Prisma.sql`stats."refundedAmount"`;
    }

    if (sortBy === 'netPaidAmount') {
      return Prisma.sql`GREATEST(
        COALESCE(stats."paidAmount", 0) -
        COALESCE(stats."refundedAmount", 0),
        0
      )`;
    }

    if (sortBy === 'shippedAt') {
      return Prisma.sql`o."shippedAt"`;
    }

    if (sortBy === 'deliveredAt') {
      return Prisma.sql`o."deliveredAt"`;
    }

    return Prisma.sql`o."createdAt"`;
  }

  private resolveSortDirection(sortDirection?: string): Prisma.Sql {
    return sortDirection === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
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

  private toDecimal(value: string): Prisma.Decimal {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('مقدار عددی مبلغ معتبر نیست.');
    }
  }

  private toDecimalString(value: Prisma.Decimal | number | string): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }
}
