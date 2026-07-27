import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminPrepareShipmentDto } from '../dto/admin-prepare-shipment.dto';

import { AdminQueryShipmentDto } from '../dto/admin-query-shipment.dto';

import { AdminShipmentNoteDto } from '../dto/admin-shipment-note.dto';

import { AdminUpdateShipmentDto } from '../dto/admin-update-shipment.dto';

import { AdminUpdateShipmentStatusDto } from '../dto/admin-update-shipment-status.dto';

type CountRow = {
  count: number | bigint;
};

type SumRow = {
  count: number | bigint;
  totalAmount: unknown;
};

export type AdminShipmentRow = {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  subtotal: unknown;
  taxAmount: unknown;
  shippingAmount: unknown;
  discountAmount: unknown;
  totalAmount: unknown;
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  userEmail: string | null;
  userPhone: string | null;
  userFirstName: string | null;
  userLastName: string | null;

  itemCount: number | bigint;
  totalQuantity: number | bigint;
  paidAmount: unknown;
  invoiceId: string | null;
  invoiceStatus: string | null;
};

type ShipmentItemRow = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number | bigint;
  price: unknown;
  productName: string;
  sku: string;
  discount: unknown;
  createdAt: Date;
};

type PaymentRow = {
  id: string;
  amount: unknown;
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
  data: unknown;
  timestamp: Date;
  createdAt: Date;
};

type TimelineRow = {
  source: string;
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  amount: unknown;
  currency: string | null;
  occurredAt: Date;
};

@Injectable()
export class AdminShipmentService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 200;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminQueryShipmentDto) {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const skip = (page - 1) * limit;

    const where = this.buildShipmentWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<AdminShipmentRow[]>(
        Prisma.sql`
            ${this.shipmentSelectSql()}
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
      data: rows.map((row) => this.mapShipment(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(orderId: string, includeDeleted = true) {
    const shipment = await this.findShipmentRow(orderId, includeDeleted);

    const [items, payments, shippingAddress, billingAddress, notes, timeline] =
      await Promise.all([
        this.findItems(orderId),
        this.findPayments(orderId),
        shipment.shippingAddressId
          ? this.findAddress(shipment.shippingAddressId)
          : null,
        shipment.billingAddressId
          ? this.findAddress(shipment.billingAddressId)
          : null,
        this.findShipmentNotes(orderId, 20),
        this.findShipmentTimeline(orderId, 80),
      ]);

    return {
      ...this.mapShipment(shipment),
      items: items.map((item) => this.mapItem(item)),
      payments: payments.map((payment) => this.mapPayment(payment)),
      shippingAddress: shippingAddress
        ? this.mapAddress(shippingAddress)
        : null,
      billingAddress: billingAddress ? this.mapAddress(billingAddress) : null,
      notes: notes.map((note) => this.mapNote(note)),
      timeline: timeline.map((row) => this.mapTimeline(row)),
    };
  }

  async getDashboard(query: AdminQueryShipmentDto) {
    const where = this.buildShipmentWhere({
      ...query,
      includeDeleted: false,
    });

    const [
      totalRows,
      pendingRows,
      processingRows,
      shippedRows,
      deliveredRows,
      cancelledRows,
      delayedRows,
      noTrackingRows,
    ] = await Promise.all([
      this.aggregate(where),
      this.aggregate([
        ...where,
        Prisma.sql`o."status"::text IN ('PENDING', 'CONFIRMED')`,
      ]),
      this.aggregate([...where, Prisma.sql`o."status"::text = 'PROCESSING'`]),
      this.aggregate([...where, Prisma.sql`o."status"::text = 'SHIPPED'`]),
      this.aggregate([...where, Prisma.sql`o."status"::text = 'DELIVERED'`]),
      this.aggregate([...where, Prisma.sql`o."status"::text = 'CANCELLED'`]),
      this.aggregate([
        ...where,
        Prisma.sql`o."status"::text IN ('CONFIRMED', 'PROCESSING')`,
        Prisma.sql`o."shippedAt" IS NULL`,
        Prisma.sql`o."createdAt" <= NOW() - INTERVAL '2 days'`,
      ]),
      this.aggregate([
        ...where,
        Prisma.sql`o."status"::text IN ('PROCESSING', 'SHIPPED')`,
        Prisma.sql`o."trackingNumber" IS NULL`,
      ]),
    ]);

    return {
      total: this.mapAggregate(totalRows[0]),
      pending: this.mapAggregate(pendingRows[0]),
      processing: this.mapAggregate(processingRows[0]),
      shipped: this.mapAggregate(shippedRows[0]),
      delivered: this.mapAggregate(deliveredRows[0]),
      cancelled: this.mapAggregate(cancelledRows[0]),
      delayed: this.mapAggregate(delayedRows[0]),
      noTracking: this.mapAggregate(noTrackingRows[0]),
    };
  }

  async prepareShipment(
    orderId: string,
    dto: AdminPrepareShipmentDto,
    actorId?: string,
  ) {
    const current = await this.findShipmentRow(orderId, false);

    this.assertShipmentCanBePrepared(current);

    if (dto.shippingAddressId) {
      await this.assertAddressExists(dto.shippingAddressId);
    }

    if (dto.billingAddressId) {
      await this.assertAddressExists(dto.billingAddressId);
    }

    const nextStatus =
      dto.status ??
      (current.status === 'PENDING' || current.status === 'CONFIRMED'
        ? 'PROCESSING'
        : current.status);

    const assignments: Prisma.Sql[] = [
      Prisma.sql`"status" = ${nextStatus}::"OrderStatus"`,
    ];

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
      'shipment.prepared',
      'ارسال سفارش توسط ادمین آماده‌سازی شد.',
      orderId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: nextStatus,
        shippingMethod: dto.shippingMethod ?? current.shippingMethod,
        trackingNumber: dto.trackingNumber ?? current.trackingNumber,
      },
    );

    return {
      shipment: await this.findOne(orderId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'shipment.prepared',
      },
    };
  }

  async updateShipment(
    orderId: string,
    dto: AdminUpdateShipmentDto,
    actorId?: string,
  ) {
    await this.findShipmentRow(orderId, false);

    if (dto.shippingAddressId) {
      await this.assertAddressExists(dto.shippingAddressId);
    }

    if (dto.billingAddressId) {
      await this.assertAddressExists(dto.billingAddressId);
    }

    const assignments = this.buildUpdateAssignments(dto);

    if (assignments.length === 0) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی ارسال سفارش ارسال نشده است.',
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
      'shipment.updated',
      'اطلاعات ارسال سفارش توسط ادمین به‌روزرسانی شد.',
      orderId,
      actorId,
      {
        changedFields: Object.keys(dto),
      },
    );

    return {
      shipment: await this.findOne(orderId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'shipment.updated',
      },
    };
  }

  async updateStatus(
    orderId: string,
    dto: AdminUpdateShipmentStatusDto,
    actorId?: string,
  ) {
    const current = await this.findShipmentRow(orderId, false);

    this.assertShipmentCanChangeStatus(current, dto.status);

    const assignments: Prisma.Sql[] = [
      Prisma.sql`"status" = ${dto.status}::"OrderStatus"`,
    ];

    if (dto.shippingMethod !== undefined) {
      assignments.push(Prisma.sql`"shippingMethod" = ${dto.shippingMethod}`);
    }

    if (dto.trackingNumber !== undefined) {
      assignments.push(Prisma.sql`"trackingNumber" = ${dto.trackingNumber}`);
    }

    if (dto.status === 'SHIPPED') {
      assignments.push(
        Prisma.sql`"shippedAt" = ${dto.shippedAt ? new Date(dto.shippedAt) : new Date()}`,
      );
    }

    if (dto.status === 'DELIVERED') {
      if (current.shippedAt === null) {
        assignments.push(
          Prisma.sql`"shippedAt" = ${dto.shippedAt ? new Date(dto.shippedAt) : new Date()}`,
        );
      }

      assignments.push(
        Prisma.sql`"deliveredAt" = ${dto.deliveredAt ? new Date(dto.deliveredAt) : new Date()}`,
      );
    }

    if (dto.status === 'CANCELLED') {
      assignments.push(
        Prisma.sql`"cancelledAt" = ${dto.cancelledAt ? new Date(dto.cancelledAt) : new Date()}`,
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
      'shipment.status.updated',
      'وضعیت ارسال سفارش توسط ادمین تغییر کرد.',
      orderId,
      actorId,
      {
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    );

    return {
      shipment: await this.findOne(orderId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'shipment.status_updated',
        previousStatus: current.status,
        currentStatus: dto.status,
        reason: dto.reason ?? null,
      },
    };
  }

  async markAsShipped(
    orderId: string,
    dto: Partial<AdminUpdateShipmentStatusDto>,
    actorId?: string,
  ) {
    return this.updateStatus(
      orderId,
      {
        status: 'SHIPPED',
        shippingMethod: dto.shippingMethod,
        trackingNumber: dto.trackingNumber,
        shippedAt: dto.shippedAt,
        reason: dto.reason,
      },
      actorId,
    );
  }

  async markAsDelivered(
    orderId: string,
    dto: Partial<AdminUpdateShipmentStatusDto>,
    actorId?: string,
  ) {
    return this.updateStatus(
      orderId,
      {
        status: 'DELIVERED',
        shippedAt: dto.shippedAt,
        deliveredAt: dto.deliveredAt,
        reason: dto.reason,
      },
      actorId,
    );
  }

  async cancelShipment(
    orderId: string,
    dto: Partial<AdminUpdateShipmentStatusDto>,
    actorId?: string,
  ) {
    return this.updateStatus(
      orderId,
      {
        status: 'CANCELLED',
        cancelledAt: dto.cancelledAt,
        reason: dto.reason,
      },
      actorId,
    );
  }

  async restore(orderId: string, actorId?: string) {
    await this.findShipmentRow(orderId, true);

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
      'shipment.order_restored',
      'سفارش مرتبط با ارسال توسط ادمین بازگردانی شد.',
      orderId,
      actorId,
      {},
    );

    return {
      shipment: await this.findOne(orderId, true),
      audit: {
        actorId: actorId ?? null,
        action: 'shipment.order_restored',
      },
    };
  }

  async getNotes(orderId: string, limit = 50) {
    await this.findShipmentRow(orderId, true);

    const notes = await this.findShipmentNotes(orderId, limit);

    return {
      data: notes.map((note) => this.mapNote(note)),
      meta: {
        orderId,
        total: notes.length,
      },
    };
  }

  async createNote(
    orderId: string,
    dto: AdminShipmentNoteDto,
    actorId?: string,
  ) {
    await this.findShipmentRow(orderId, true);

    const noteId = await this.createSystemEvent(
      'shipment.note.created',
      'یادداشت مدیریتی برای ارسال سفارش ثبت شد.',
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
      message: 'یادداشت ارسال سفارش با موفقیت ثبت شد.',
    };
  }

  async getTimeline(orderId: string, limit = 100) {
    await this.findShipmentRow(orderId, true);

    const safeLimit = Math.min(Math.max(limit, 1), 300);

    const rows = await this.findShipmentTimeline(orderId, safeLimit);

    return {
      data: rows.map((row) => this.mapTimeline(row)),
      meta: {
        orderId,
        total: rows.length,
      },
    };
  }

  async getTracking(orderId: string) {
    const shipment = await this.findShipmentRow(orderId, true);

    return {
      orderId: shipment.id,
      orderNumber: shipment.orderNumber,
      status: shipment.status,
      shippingMethod: shipment.shippingMethod,
      trackingNumber: shipment.trackingNumber,
      shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
      deliveredAt: shipment.deliveredAt
        ? shipment.deliveredAt.toISOString()
        : null,
      cancelledAt: shipment.cancelledAt
        ? shipment.cancelledAt.toISOString()
        : null,
    };
  }

  async findForExport(query: AdminQueryShipmentDto) {
    const where = this.buildShipmentWhere(query);

    const rows = await this.prisma.$queryRaw<AdminShipmentRow[]>(
      Prisma.sql`
          ${this.shipmentSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          ORDER BY
            o."createdAt" DESC,
            o."id" DESC
          LIMIT 5000
        `,
    );

    return rows.map((row) => this.mapShipment(row));
  }

  async findShipmentRow(
    orderId: string,
    includeDeleted: boolean,
  ): Promise<AdminShipmentRow> {
    const where: Prisma.Sql[] = [Prisma.sql`o."id" = ${orderId}`];

    if (!includeDeleted) {
      where.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<AdminShipmentRow[]>(
      Prisma.sql`
          ${this.shipmentSelectSql()}
          WHERE ${Prisma.join(where, ' AND ')}
          LIMIT 1
        `,
    );

    const shipment = rows[0];

    if (!shipment) {
      throw new NotFoundException('ارسال سفارش موردنظر یافت نشد.');
    }

    return shipment;
  }

  private shipmentSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        o."id",
        o."orderNumber",
        o."userId",
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
        o."createdAt",
        o."updatedAt",
        o."deleted_at" AS "deletedAt",

        u."email" AS "userEmail",
        u."phone" AS "userPhone",
        u."firstName" AS "userFirstName",
        u."lastName" AS "userLastName",

        COALESCE(stats."itemCount", 0)::int AS "itemCount",
        COALESCE(stats."totalQuantity", 0)::int AS "totalQuantity",
        COALESCE(stats."paidAmount", 0)::numeric AS "paidAmount",
        invoice."id" AS "invoiceId",
        invoice."status"::text AS "invoiceStatus"
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
              AND p."paymentStatus"::text = 'COMPLETED'
          ) AS "paidAmount"
      ) stats ON TRUE
    `;
  }

  private findItems(orderId: string): Promise<ShipmentItemRow[]> {
    return this.prisma.$queryRaw<ShipmentItemRow[]>(
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
        ORDER BY
          "createdAt" ASC,
          "id" ASC
      `,
    );
  }

  private findPayments(orderId: string): Promise<PaymentRow[]> {
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
        ORDER BY
          "createdAt" DESC,
          "id" DESC
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

  private findShipmentNotes(
    orderId: string,
    limit: number,
  ): Promise<EventRow[]> {
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
          AND "name" = 'shipment.note.created'
          AND "data" #>> '{orderId}' = ${orderId}
        ORDER BY
          "timestamp" DESC,
          "createdAt" DESC
        LIMIT ${Math.min(Math.max(limit, 1), 200)}
      `,
    );
  }

  private findShipmentTimeline(
    orderId: string,
    limit: number,
  ): Promise<TimelineRow[]> {
    return this.prisma.$queryRaw<TimelineRow[]>(
      Prisma.sql`
        SELECT *
        FROM (
          SELECT
            'shipment'::text AS "source",
            o."id" AS "id",
            CONCAT('ارسال سفارش ', o."orderNumber") AS "title",
            o."shippingMethod" AS "description",
            o."status"::text AS "status",
            o."shippingAmount" AS "amount",
            o."currency" AS "currency",
            o."updatedAt" AS "occurredAt"
          FROM "Order" o
          WHERE o."id" = ${orderId}

          UNION ALL

          SELECT
            'payment'::text AS "source",
            p."id" AS "id",
            'پرداخت مرتبط با ارسال'::text AS "title",
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
            AND (
              e."category" = 'shipment'
              OR e."name" ILIKE 'shipment.%'
              OR e."name" ILIKE 'order.%'
            )
        ) timeline
        ORDER BY
          timeline."occurredAt" DESC,
          timeline."id" DESC
        LIMIT ${limit}
      `,
    );
  }

  private buildShipmentWhere(query: AdminQueryShipmentDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [Prisma.sql`TRUE`];

    if (query.includeDeleted !== true) {
      where.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    if (query.q) {
      where.push(
        Prisma.sql`(
          o."orderNumber" ILIKE ${`%${query.q}%`}
          OR o."trackingNumber" ILIKE ${`%${query.q}%`}
          OR o."shippingMethod" ILIKE ${`%${query.q}%`}
          OR o."notes" ILIKE ${`%${query.q}%`}
          OR u."email" ILIKE ${`%${query.q}%`}
          OR u."phone" ILIKE ${`%${query.q}%`}
          OR u."firstName" ILIKE ${`%${query.q}%`}
          OR u."lastName" ILIKE ${`%${query.q}%`}
        )`,
      );
    }

    if (query.orderId) {
      where.push(Prisma.sql`o."id" = ${query.orderId}`);
    }

    if (query.orderNumber) {
      where.push(Prisma.sql`o."orderNumber" ILIKE ${`%${query.orderNumber}%`}`);
    }

    if (query.userId) {
      where.push(Prisma.sql`o."userId" = ${query.userId}`);
    }

    if (query.email) {
      where.push(Prisma.sql`u."email" ILIKE ${`%${query.email}%`}`);
    }

    if (query.phone) {
      where.push(Prisma.sql`u."phone" ILIKE ${`%${query.phone}%`}`);
    }

    if (query.status) {
      where.push(Prisma.sql`o."status"::text = ${query.status}`);
    }

    if (query.paymentStatus) {
      where.push(Prisma.sql`o."paymentStatus"::text = ${query.paymentStatus}`);
    }

    if (query.shippingMethod) {
      where.push(
        Prisma.sql`o."shippingMethod" ILIKE ${`%${query.shippingMethod}%`}`,
      );
    }

    if (query.trackingNumber) {
      where.push(
        Prisma.sql`o."trackingNumber" ILIKE ${`%${query.trackingNumber}%`}`,
      );
    }

    if (query.hasTrackingNumber === true) {
      where.push(Prisma.sql`o."trackingNumber" IS NOT NULL`);
    }

    if (query.hasTrackingNumber === false) {
      where.push(Prisma.sql`o."trackingNumber" IS NULL`);
    }

    if (query.hasShippedAt === true) {
      where.push(Prisma.sql`o."shippedAt" IS NOT NULL`);
    }

    if (query.hasShippedAt === false) {
      where.push(Prisma.sql`o."shippedAt" IS NULL`);
    }

    if (query.hasDeliveredAt === true) {
      where.push(Prisma.sql`o."deliveredAt" IS NOT NULL`);
    }

    if (query.hasDeliveredAt === false) {
      where.push(Prisma.sql`o."deliveredAt" IS NULL`);
    }

    if (query.delayedOnly === true) {
      where.push(Prisma.sql`o."status"::text IN ('CONFIRMED', 'PROCESSING')`);

      where.push(Prisma.sql`o."shippedAt" IS NULL`);

      where.push(Prisma.sql`o."createdAt" <= NOW() - INTERVAL '2 days'`);
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

  private buildUpdateAssignments(dto: AdminUpdateShipmentDto): Prisma.Sql[] {
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
      throw new BadRequestException('آدرس انتخاب‌شده برای ارسال معتبر نیست.');
    }
  }

  private assertShipmentCanBePrepared(order: AdminShipmentRow): void {
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      throw new BadRequestException(
        'سفارش لغوشده یا بازگشت‌خورده قابل آماده‌سازی برای ارسال نیست.',
      );
    }

    if (order.status === 'DELIVERED') {
      throw new BadRequestException(
        'سفارش تحویل‌شده قابل آماده‌سازی دوباره نیست.',
      );
    }
  }

  private assertShipmentCanChangeStatus(
    order: AdminShipmentRow,
    nextStatus: string,
  ): void {
    if (order.status === 'REFUNDED') {
      throw new BadRequestException(
        'وضعیت ارسال سفارش بازگشت‌خورده قابل تغییر نیست.',
      );
    }

    if (order.status === 'DELIVERED' && nextStatus !== 'DELIVERED') {
      throw new BadRequestException(
        'وضعیت سفارش تحویل‌شده قابل بازگشت به مراحل قبلی نیست.',
      );
    }

    if (order.status === 'CANCELLED' && nextStatus !== 'CANCELLED') {
      throw new BadRequestException(
        'وضعیت ارسال سفارش لغوشده قابل تغییر نیست.',
      );
    }
  }

  private aggregate(where: Prisma.Sql[]): Promise<SumRow[]> {
    return this.prisma.$queryRaw<SumRow[]>(
      Prisma.sql`
        SELECT
          COUNT(*)::int AS "count",
          COALESCE(SUM(o."totalAmount"), 0)::numeric AS "totalAmount"
        FROM "Order" o
        LEFT JOIN "User" u
          ON u."id" = o."userId"
        LEFT JOIN "Invoice" invoice
          ON invoice."orderId" = o."id"
          AND invoice."deleted_at" IS NULL
        WHERE ${Prisma.join(where, ' AND ')}
      `,
    );
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
          'shipment',
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

  private mapShipment(row: AdminShipmentRow) {
    return {
      id: row.id,
      orderId: row.id,
      orderNumber: row.orderNumber,
      customer: {
        id: row.userId,
        email: row.userEmail,
        phone: row.userPhone,
        firstName: row.userFirstName,
        lastName: row.userLastName,
        fullName: `${row.userFirstName ?? ''} ${row.userLastName ?? ''}`.trim(),
      },
      status: row.status,
      payment: {
        status: row.paymentStatus,
        method: row.paymentMethod,
        paidAmount: this.toDecimalString(row.paidAmount),
      },
      amounts: {
        subtotal: this.toDecimalString(row.subtotal),
        taxAmount: this.toDecimalString(row.taxAmount),
        shippingAmount: this.toDecimalString(row.shippingAmount),
        discountAmount: this.toDecimalString(row.discountAmount),
        totalAmount: this.toDecimalString(row.totalAmount),
        currency: row.currency,
      },
      shipment: {
        method: row.shippingMethod,
        trackingNumber: row.trackingNumber,
        hasTrackingNumber: row.trackingNumber !== null,
        shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
        deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
        cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      },
      addresses: {
        shippingAddressId: row.shippingAddressId,
        billingAddressId: row.billingAddressId,
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
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    };
  }

  private mapItem(row: ShipmentItemRow) {
    const quantity = this.toNumber(row.quantity);

    const lineTotal = new Prisma.Decimal(this.toDecimalString(row.price))
      .mul(quantity)
      .minus(new Prisma.Decimal(this.toDecimalString(row.discount)));

    return {
      id: row.id,
      productId: row.productId,
      variantId: row.variantId,
      quantity,
      price: this.toDecimalString(row.price),
      productName: row.productName,
      sku: row.sku,
      discount: this.toDecimalString(row.discount),
      lineTotal: lineTotal.toFixed(2),
      createdAt: row.createdAt.toISOString(),
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
      refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
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
    };
  }

  private mapTimeline(row: TimelineRow) {
    return {
      source: row.source,
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      amount: row.amount === null ? null : this.toDecimalString(row.amount),
      currency: row.currency,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  private mapAggregate(row?: SumRow) {
    return {
      count: this.toNumber(row?.count),
      totalAmount: this.toDecimalString(row?.totalAmount ?? 0),
    };
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

    if (sortBy === 'shippingMethod') {
      return Prisma.sql`o."shippingMethod"`;
    }

    if (sortBy === 'trackingNumber') {
      return Prisma.sql`o."trackingNumber"`;
    }

    if (sortBy === 'shippedAt') {
      return Prisma.sql`o."shippedAt"`;
    }

    if (sortBy === 'deliveredAt') {
      return Prisma.sql`o."deliveredAt"`;
    }

    if (sortBy === 'cancelledAt') {
      return Prisma.sql`o."cancelledAt"`;
    }

    if (sortBy === 'totalAmount') {
      return Prisma.sql`o."totalAmount"`;
    }

    if (sortBy === 'userEmail') {
      return Prisma.sql`u."email"`;
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

  private toDecimalString(value: unknown): string {
    if (value === undefined || value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return new Prisma.Decimal(value).toFixed(2);
    }

    if (typeof value === 'bigint') {
      return new Prisma.Decimal(value.toString()).toFixed(2);
    }

    throw new TypeError('Unsupported decimal value.');
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
