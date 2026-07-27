import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrderStatus, PaymentStatus, Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateShipmentDto } from '../dto/create-shipment.dto';

import { QueryShipmentDto } from '../dto/query-shipment.dto';

import { TrackShipmentDto } from '../dto/track-shipment.dto';

import { UpdateShipmentDto } from '../dto/update-shipment.dto';

import { UpdateShipmentStatusDto } from '../dto/update-shipment-status.dto';

import { ShipmentEventPublisher } from '../events/shipment.event.publisher';

type CountRow = {
  count: number;
};

type ShipmentOrderRow = {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  currency: string;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  shippingMethod: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ShipmentListResponse = {
  data: ShipmentResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/** Customer-facing shipment contract; excludes ownership and soft-delete data. */
export type CustomerShipmentResponse = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  shippingAmount: string;
  shippingMethod: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  shippedAtFa: string | null;
  deliveredAt: Date | null;
  deliveredAtFa: string | null;
  cancelledAt: Date | null;
  cancelledAtFa: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  timeline: PublicShipmentTimelineItem[];
};

type CustomerShipmentListResponse = {
  data: CustomerShipmentResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ShipmentResponse = {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus | null;
  paymentMethod: string | null;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  shippingAmount: string;
  totalAmount: string;
  shippingMethod: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  shippedAtFa: string | null;
  deliveredAt: Date | null;
  deliveredAtFa: string | null;
  cancelledAt: Date | null;
  cancelledAtFa: string | null;
  createdAt: Date;
  createdAtFa: string | null;
  updatedAt: Date;
  updatedAtFa: string | null;
  deletedAt: Date | null;
  deletedAtFa: string | null;
};

type PublicShipmentStatus =
  'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

type PublicShipmentTimelineItem = {
  key: PublicShipmentStatus;
  title: string;
  completed: boolean;
  occurredAt: string | null;
  occurredAtFa: string | null;
};

type PublicShipmentTrackingResponse = {
  orderNumber: string;
  status: PublicShipmentStatus;
  shipment: {
    method: string | null;
    trackingNumber: string | null;
    hasTrackingNumber: boolean;
    shippedAt: string | null;
    shippedAtFa: string | null;
    deliveredAt: string | null;
    deliveredAtFa: string | null;
    cancelledAt: string | null;
    cancelledAtFa: string | null;
  };
  timeline: PublicShipmentTimelineItem[];
  updatedAt: string;
  updatedAtFa: string | null;
};

type ShipmentMutationOptions = {
  actorId?: string;
};

type ShipmentStatusMutationDto = Partial<UpdateShipmentStatusDto> & {
  cancelledAt?: string;
};

@Injectable()
export class ShipmentService {
  private readonly defaultPage = 1;

  private readonly defaultLimit = 20;

  private readonly maxLimit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ShipmentEventPublisher,
  ) {}

  async findAllForAdmin(
    query: QueryShipmentDto,
  ): Promise<ShipmentListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildAdminWhere(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ShipmentOrderRow[]>(
        Prisma.sql`
            ${this.shipmentSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              o."updatedAt" DESC,
              o."createdAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Order" o
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

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

  async findAllForUser(
    userId: string,
    query: QueryShipmentDto,
  ): Promise<CustomerShipmentListResponse> {
    const page = this.normalizePage(query.page);

    const limit = this.normalizeLimit(query.limit);

    const offset = (page - 1) * limit;

    const where = this.buildUserWhere(userId, query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<ShipmentOrderRow[]>(
        Prisma.sql`
            ${this.shipmentSelectSql()}
            WHERE ${Prisma.join(where, ' AND ')}
            ORDER BY
              o."updatedAt" DESC,
              o."createdAt" DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `,
      ),
      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT
              COUNT(*)::int AS "count"
            FROM "Order" o
            WHERE ${Prisma.join(where, ' AND ')}
          `,
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      data: rows.map((row) => this.mapCustomerShipment(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneForAdmin(
    orderId: string,
    includeDeleted = false,
  ): Promise<ShipmentResponse> {
    const order = await this.findOrderById(orderId, {
      includeDeleted,
    });

    return this.mapShipment(order);
  }

  async findOneForUser(
    userId: string,
    orderId: string,
  ): Promise<CustomerShipmentResponse> {
    const order = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    if (order.userId !== userId) {
      throw new NotFoundException('اطلاعات ارسال سفارش یافت نشد.');
    }

    return this.mapCustomerShipment(order);
  }

  async trackShipment(
    dto: TrackShipmentDto,
  ): Promise<PublicShipmentTrackingResponse> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`o."deleted_at" IS NULL`,
      Prisma.sql`o."orderNumber" = ${dto.orderNumber}`,
      Prisma.sql`o."trackingNumber" = ${dto.trackingNumber}`,
    ];

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          ${this.shipmentSelectSql()}
          WHERE ${Prisma.join(conditions, ' AND ')}
          ORDER BY
            o."updatedAt" DESC
          LIMIT 1
        `,
    );

    const order = rows[0];

    if (!order) {
      throw new NotFoundException('اطلاعات رهگیری ارسال سفارش یافت نشد.');
    }

    return this.mapPublicTracking(order);
  }

  async createShipment(
    orderId: string,
    dto: CreateShipmentDto,
    options: ShipmentMutationOptions = {},
  ): Promise<ShipmentResponse> {
    const current = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    this.assertCanPrepareShipment(current);

    if (current.shippingMethod || current.trackingNumber) {
      throw new BadRequestException(
        'اطلاعات ارسال این سفارش قبلاً ثبت شده است. برای تغییر اطلاعات از ویرایش ارسال استفاده کنید.',
      );
    }

    const now = new Date();

    const shouldMarkAsShipped = dto.markAsShipped === true;

    const shippedAt = shouldMarkAsShipped
      ? (this.parseOptionalDate(dto.shippedAt) ?? now)
      : (this.parseOptionalDate(dto.shippedAt) ?? null);

    const nextStatus = shouldMarkAsShipped
      ? OrderStatus.SHIPPED
      : current.status;

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          UPDATE "Order"
          SET
            "shippingMethod" = ${dto.shippingMethod},
            "trackingNumber" = ${dto.trackingNumber ?? null},
            "status" = ${nextStatus}::"OrderStatus",
            "shippedAt" = ${shippedAt},
            "updatedAt" = NOW()
          WHERE
            "id" = ${orderId}
            AND "deleted_at" IS NULL
          RETURNING
            ${this.shipmentReturningSql()}
        `,
    );

    const updated = this.requireUpdatedOrder(rows);

    this.events.publishShipmentCreated({
      orderId: updated.id,
      userId: updated.userId,
      orderNumber: updated.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      status: updated.status,
      shippingMethod: updated.shippingMethod,
      trackingNumber: updated.trackingNumber,
      occurredAt: now,
    });

    if (shouldMarkAsShipped) {
      this.events.publishOrderShipped({
        orderId: updated.id,
        userId: updated.userId,
        orderNumber: updated.orderNumber,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        previousStatus: current.status,
        currentStatus: OrderStatus.SHIPPED,
        shippingMethod: updated.shippingMethod,
        trackingNumber: updated.trackingNumber,
        shippedAt: updated.shippedAt ?? now,
        occurredAt: now,
      });
    }

    return this.mapShipment(updated);
  }

  async updateShipment(
    orderId: string,
    dto: UpdateShipmentDto,
    options: ShipmentMutationOptions = {},
  ): Promise<ShipmentResponse> {
    const current = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    this.assertCanUpdateShipment(current);

    const nextShippingMethod = dto.shippingMethod ?? current.shippingMethod;

    const nextTrackingNumber = dto.trackingNumber ?? current.trackingNumber;

    const nextShippedAt =
      this.parseOptionalDate(dto.shippedAt) ?? current.shippedAt;

    const nextDeliveredAt =
      this.parseOptionalDate(dto.deliveredAt) ?? current.deliveredAt;

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          UPDATE "Order"
          SET
            "shippingMethod" = ${nextShippingMethod},
            "trackingNumber" = ${nextTrackingNumber},
            "shippedAt" = ${nextShippedAt},
            "deliveredAt" = ${nextDeliveredAt},
            "updatedAt" = NOW()
          WHERE
            "id" = ${orderId}
            AND "deleted_at" IS NULL
          RETURNING
            ${this.shipmentReturningSql()}
        `,
    );

    const updated = this.requireUpdatedOrder(rows);

    this.events.publishShipmentUpdated({
      orderId: updated.id,
      userId: updated.userId,
      orderNumber: updated.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      previousShippingMethod: current.shippingMethod,
      currentShippingMethod: updated.shippingMethod,
      previousTrackingNumber: current.trackingNumber,
      currentTrackingNumber: updated.trackingNumber,
      previousStatus: current.status,
      currentStatus: updated.status,
      occurredAt: new Date(),
    });

    if (
      current.shippingMethod !== updated.shippingMethod ||
      current.trackingNumber !== updated.trackingNumber
    ) {
      this.events.publishTrackingUpdated({
        orderId: updated.id,
        userId: updated.userId,
        orderNumber: updated.orderNumber,
        actorId: options.actorId,
        notifyCustomer: dto.notifyCustomer !== false,
        previousShippingMethod: current.shippingMethod,
        currentShippingMethod: updated.shippingMethod,
        previousTrackingNumber: current.trackingNumber,
        currentTrackingNumber: updated.trackingNumber,
        occurredAt: new Date(),
      });
    }

    return this.mapShipment(updated);
  }

  async updateShipmentStatus(
    orderId: string,
    dto: UpdateShipmentStatusDto,
    options: ShipmentMutationOptions = {},
  ): Promise<ShipmentResponse> {
    if (dto.status === OrderStatus.SHIPPED) {
      return this.markAsShipped(orderId, dto, options);
    }

    if (dto.status === OrderStatus.DELIVERED) {
      return this.markAsDelivered(orderId, dto, options);
    }

    if (dto.status === OrderStatus.CANCELLED) {
      return this.cancelShipment(orderId, dto, options);
    }

    const current = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    if (dto.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException('وضعیت ارسال انتخاب‌شده معتبر نیست.');
    }

    if (
      current.status !== OrderStatus.CONFIRMED &&
      current.status !== OrderStatus.PROCESSING
    ) {
      throw new BadRequestException(
        'این سفارش در وضعیت فعلی قابل پردازش ارسال نیست.',
      );
    }

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          UPDATE "Order"
          SET
            "status" = ${OrderStatus.PROCESSING}::"OrderStatus",
            "updatedAt" = NOW()
          WHERE
            "id" = ${orderId}
            AND "deleted_at" IS NULL
          RETURNING
            ${this.shipmentReturningSql()}
        `,
    );

    const updated = this.requireUpdatedOrder(rows);

    this.events.publishShipmentUpdated({
      orderId: updated.id,
      userId: updated.userId,
      orderNumber: updated.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      previousStatus: current.status,
      currentStatus: updated.status,
      occurredAt: new Date(),
    });

    return this.mapShipment(updated);
  }

  async markAsShipped(
    orderId: string,
    dto: ShipmentStatusMutationDto = {},
    options: ShipmentMutationOptions = {},
  ): Promise<ShipmentResponse> {
    const current = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    this.assertCanMarkAsShipped(current);

    const shippingMethod = dto.shippingMethod ?? current.shippingMethod;

    if (!shippingMethod) {
      throw new BadRequestException(
        'برای ثبت ارسال سفارش، روش ارسال الزامی است.',
      );
    }

    const trackingNumber = dto.trackingNumber ?? current.trackingNumber;

    const shippedAt =
      this.parseOptionalDate(dto.shippedAt) ?? current.shippedAt ?? new Date();

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          UPDATE "Order"
          SET
            "status" = ${OrderStatus.SHIPPED}::"OrderStatus",
            "shippingMethod" = ${shippingMethod},
            "trackingNumber" = ${trackingNumber},
            "shippedAt" = ${shippedAt},
            "updatedAt" = NOW()
          WHERE
            "id" = ${orderId}
            AND "deleted_at" IS NULL
          RETURNING
            ${this.shipmentReturningSql()}
        `,
    );

    const updated = this.requireUpdatedOrder(rows);

    this.events.publishOrderShipped({
      orderId: updated.id,
      userId: updated.userId,
      orderNumber: updated.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      previousStatus: current.status,
      currentStatus: OrderStatus.SHIPPED,
      shippingMethod: updated.shippingMethod,
      trackingNumber: updated.trackingNumber,
      shippedAt: updated.shippedAt ?? shippedAt,
      occurredAt: new Date(),
    });

    return this.mapShipment(updated);
  }

  async markAsDelivered(
    orderId: string,
    dto: ShipmentStatusMutationDto = {},
    options: ShipmentMutationOptions = {},
  ): Promise<ShipmentResponse> {
    const current = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    this.assertCanMarkAsDelivered(current);

    const deliveredAt =
      this.parseOptionalDate(dto.deliveredAt) ??
      current.deliveredAt ??
      new Date();

    const shippedAt =
      this.parseOptionalDate(dto.shippedAt) ?? current.shippedAt ?? deliveredAt;

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          UPDATE "Order"
          SET
            "status" = ${OrderStatus.DELIVERED}::"OrderStatus",
            "shippedAt" = ${shippedAt},
            "deliveredAt" = ${deliveredAt},
            "updatedAt" = NOW()
          WHERE
            "id" = ${orderId}
            AND "deleted_at" IS NULL
          RETURNING
            ${this.shipmentReturningSql()}
        `,
    );

    const updated = this.requireUpdatedOrder(rows);

    this.events.publishOrderDelivered({
      orderId: updated.id,
      userId: updated.userId,
      orderNumber: updated.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      previousStatus: current.status,
      currentStatus: OrderStatus.DELIVERED,
      deliveredAt: updated.deliveredAt ?? deliveredAt,
      occurredAt: new Date(),
    });

    return this.mapShipment(updated);
  }

  async cancelShipment(
    orderId: string,
    dto: ShipmentStatusMutationDto = {},
    options: ShipmentMutationOptions = {},
  ): Promise<ShipmentResponse> {
    const current = await this.findOrderById(orderId, {
      includeDeleted: false,
    });

    this.assertCanCancelShipment(current);

    const cancelledAt =
      this.parseOptionalDate(dto.cancelledAt) ??
      current.cancelledAt ??
      new Date();

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          UPDATE "Order"
          SET
            "status" = ${OrderStatus.CANCELLED}::"OrderStatus",
            "cancelledAt" = ${cancelledAt},
            "updatedAt" = NOW()
          WHERE
            "id" = ${orderId}
            AND "deleted_at" IS NULL
          RETURNING
            ${this.shipmentReturningSql()}
        `,
    );

    const updated = this.requireUpdatedOrder(rows);

    this.events.publishShipmentCancelled({
      orderId: updated.id,
      userId: updated.userId,
      orderNumber: updated.orderNumber,
      actorId: options.actorId,
      notifyCustomer: dto.notifyCustomer !== false,
      previousStatus: current.status,
      currentStatus: OrderStatus.CANCELLED,
      reason: dto.reason ?? null,
      occurredAt: new Date(),
    });

    return this.mapShipment(updated);
  }

  private async findOrderById(
    orderId: string,
    options: {
      includeDeleted: boolean;
    },
  ): Promise<ShipmentOrderRow> {
    const conditions: Prisma.Sql[] = [Prisma.sql`o."id" = ${orderId}`];

    if (!options.includeDeleted) {
      conditions.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    const rows = await this.prisma.$queryRaw<ShipmentOrderRow[]>(
      Prisma.sql`
          ${this.shipmentSelectSql()}
          WHERE ${Prisma.join(conditions, ' AND ')}
          LIMIT 1
        `,
    );

    const order = rows[0];

    if (!order) {
      throw new NotFoundException('اطلاعات ارسال سفارش یافت نشد.');
    }

    return order;
  }

  private shipmentSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        o."id",
        o."orderNumber",
        o."userId",
        o."status",
        o."paymentStatus",
        o."paymentMethod"::text AS "paymentMethod",
        o."currency",
        o."subtotal",
        o."discountAmount",
        o."taxAmount",
        o."shippingAmount",
        o."totalAmount",
        o."shippingMethod",
        o."trackingNumber",
        o."shippedAt",
        o."deliveredAt",
        o."cancelledAt",
        o."createdAt",
        o."updatedAt",
        o."deleted_at" AS "deletedAt"
      FROM "Order" o
    `;
  }

  private shipmentReturningSql(): Prisma.Sql {
    return Prisma.sql`
      "id",
      "orderNumber",
      "userId",
      "status",
      "paymentStatus",
      "paymentMethod"::text AS "paymentMethod",
      "currency",
      "subtotal",
      "discountAmount",
      "taxAmount",
      "shippingAmount",
      "totalAmount",
      "shippingMethod",
      "trackingNumber",
      "shippedAt",
      "deliveredAt",
      "cancelledAt",
      "createdAt",
      "updatedAt",
      "deleted_at" AS "deletedAt"
    `;
  }

  private buildAdminWhere(query: QueryShipmentDto): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      query.includeDeleted
        ? Prisma.sql`TRUE`
        : Prisma.sql`o."deleted_at" IS NULL`,
    ];

    this.pushSharedFilters(where, query);

    if (query.userId) {
      where.push(Prisma.sql`o."userId" = ${query.userId}`);
    }

    return where;
  }

  private buildUserWhere(
    userId: string,
    query: QueryShipmentDto,
  ): Prisma.Sql[] {
    const where: Prisma.Sql[] = [
      Prisma.sql`o."deleted_at" IS NULL`,
      Prisma.sql`o."userId" = ${userId}`,
    ];

    this.pushSharedFilters(where, query);

    return where;
  }

  private pushSharedFilters(
    where: Prisma.Sql[],
    query: QueryShipmentDto,
  ): void {
    if (query.status) {
      where.push(Prisma.sql`o."status" = ${query.status}::"OrderStatus"`);
    }

    if (query.orderNumber) {
      where.push(Prisma.sql`o."orderNumber" ILIKE ${`%${query.orderNumber}%`}`);
    }

    if (query.trackingNumber) {
      where.push(
        Prisma.sql`o."trackingNumber" ILIKE ${`%${query.trackingNumber}%`}`,
      );
    }

    if (query.shippingMethod) {
      where.push(
        Prisma.sql`o."shippingMethod" ILIKE ${`%${query.shippingMethod}%`}`,
      );
    }

    if (query.hasTrackingNumber === true) {
      where.push(Prisma.sql`o."trackingNumber" IS NOT NULL`);
    }

    if (query.hasTrackingNumber === false) {
      where.push(Prisma.sql`o."trackingNumber" IS NULL`);
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
  }

  private assertCanPrepareShipment(order: ShipmentOrderRow): void {
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
    ];

    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        'این سفارش در وضعیت فعلی قابل آماده‌سازی ارسال نیست.',
      );
    }
  }

  private assertCanUpdateShipment(order: ShipmentOrderRow): void {
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('ارسال سفارش لغوشده قابل ویرایش نیست.');
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('ارسال سفارش مرجوع‌شده قابل ویرایش نیست.');
    }
  }

  private assertCanMarkAsShipped(order: ShipmentOrderRow): void {
    const allowedStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
    ];

    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        'فقط سفارش‌های آماده پردازش قابل ثبت به‌عنوان ارسال‌شده هستند.',
      );
    }
  }

  private assertCanMarkAsDelivered(order: ShipmentOrderRow): void {
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException(
        'فقط سفارش ارسال‌شده قابل ثبت به‌عنوان تحویل‌شده است.',
      );
    }
  }

  private assertCanCancelShipment(order: ShipmentOrderRow): void {
    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'سفارش تحویل‌شده از جریان ارسال قابل لغو نیست.',
      );
    }

    if (order.status === OrderStatus.SHIPPED) {
      throw new BadRequestException(
        'سفارش ارسال‌شده از این بخش قابل لغو نیست.',
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('این سفارش قبلاً لغو شده است.');
    }

    if (order.status === OrderStatus.REFUNDED) {
      throw new BadRequestException('سفارش مرجوع‌شده قابل لغو ارسال نیست.');
    }
  }

  private requireUpdatedOrder(rows: ShipmentOrderRow[]): ShipmentOrderRow {
    const order = rows[0];

    if (!order) {
      throw new NotFoundException('سفارش یافت نشد.');
    }

    return order;
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

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ واردشده معتبر نیست.');
    }

    return date;
  }

  private toDecimalString(
    value: Prisma.Decimal | number | string | null,
  ): string {
    if (value === null) {
      return '0.00';
    }

    if (value instanceof Prisma.Decimal) {
      return value.toFixed(2);
    }

    return new Prisma.Decimal(value).toFixed(2);
  }

  private toIsoString(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private resolvePublicShipmentStatus(
    row: ShipmentOrderRow,
  ): PublicShipmentStatus {
    if (row.cancelledAt || row.status === OrderStatus.CANCELLED) {
      return 'CANCELLED';
    }

    if (row.deliveredAt) {
      return 'DELIVERED';
    }

    if (row.shippedAt) {
      return 'SHIPPED';
    }

    if (row.shippingMethod || row.trackingNumber) {
      return 'PROCESSING';
    }

    return 'PENDING';
  }

  private buildPublicTimeline(
    row: ShipmentOrderRow,
  ): PublicShipmentTimelineItem[] {
    const status = this.resolvePublicShipmentStatus(row);

    return [
      {
        key: 'PROCESSING',
        title: 'آماده‌سازی ارسال',
        completed:
          status === 'PROCESSING' ||
          status === 'SHIPPED' ||
          status === 'DELIVERED',
        occurredAt: null,
        occurredAtFa: null,
      },
      {
        key: 'SHIPPED',
        title: 'ارسال شده',
        completed: status === 'SHIPPED' || status === 'DELIVERED',
        occurredAt: this.toIsoString(row.shippedAt),
        occurredAtFa: this.toPersianDateTimeString(row.shippedAt),
      },
      {
        key: 'DELIVERED',
        title: 'تحویل شده',
        completed: status === 'DELIVERED',
        occurredAt: this.toIsoString(row.deliveredAt),
        occurredAtFa: this.toPersianDateTimeString(row.deliveredAt),
      },
      {
        key: 'CANCELLED',
        title: 'لغو شده',
        completed: status === 'CANCELLED',
        occurredAt: this.toIsoString(row.cancelledAt),
        occurredAtFa: this.toPersianDateTimeString(row.cancelledAt),
      },
    ];
  }

  private mapPublicTracking(
    row: ShipmentOrderRow,
  ): PublicShipmentTrackingResponse {
    const publicUpdatedAt =
      row.cancelledAt ?? row.deliveredAt ?? row.shippedAt ?? row.updatedAt;

    return {
      orderNumber: row.orderNumber,
      status: this.resolvePublicShipmentStatus(row),
      shipment: {
        method: row.shippingMethod,
        trackingNumber: row.trackingNumber,
        hasTrackingNumber: Boolean(row.trackingNumber),
        shippedAt: this.toIsoString(row.shippedAt),
        shippedAtFa: this.toPersianDateTimeString(row.shippedAt),
        deliveredAt: this.toIsoString(row.deliveredAt),
        deliveredAtFa: this.toPersianDateTimeString(row.deliveredAt),
        cancelledAt: this.toIsoString(row.cancelledAt),
        cancelledAtFa: this.toPersianDateTimeString(row.cancelledAt),
      },
      timeline: this.buildPublicTimeline(row),
      updatedAt: publicUpdatedAt.toISOString(),
      updatedAtFa: this.toPersianDateTimeString(publicUpdatedAt),
    };
  }

  private mapCustomerShipment(row: ShipmentOrderRow): CustomerShipmentResponse {
    return {
      id: row.id,
      orderId: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      currency: row.currency,
      shippingAmount: this.toDecimalString(row.shippingAmount),
      shippingMethod: row.shippingMethod,
      trackingNumber: row.trackingNumber,
      shippedAt: row.shippedAt,
      shippedAtFa: this.toPersianDateTimeString(row.shippedAt),
      deliveredAt: row.deliveredAt,
      deliveredAtFa: this.toPersianDateTimeString(row.deliveredAt),
      cancelledAt: row.cancelledAt,
      cancelledAtFa: this.toPersianDateTimeString(row.cancelledAt),
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      timeline: this.buildPublicTimeline(row),
    };
  }

  private mapShipment(row: ShipmentOrderRow): ShipmentResponse {
    return {
      id: row.id,
      orderId: row.id,
      orderNumber: row.orderNumber,
      userId: row.userId,
      status: row.status,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentMethod,
      currency: row.currency,
      subtotal: this.toDecimalString(row.subtotal),
      discountAmount: this.toDecimalString(row.discountAmount),
      taxAmount: this.toDecimalString(row.taxAmount),
      shippingAmount: this.toDecimalString(row.shippingAmount),
      totalAmount: this.toDecimalString(row.totalAmount),
      shippingMethod: row.shippingMethod,
      trackingNumber: row.trackingNumber,
      shippedAt: row.shippedAt,
      shippedAtFa: this.toPersianDateTimeString(row.shippedAt),
      deliveredAt: row.deliveredAt,
      deliveredAtFa: this.toPersianDateTimeString(row.deliveredAt),
      cancelledAt: row.cancelledAt,
      cancelledAtFa: this.toPersianDateTimeString(row.cancelledAt),
      createdAt: row.createdAt,
      createdAtFa: this.toPersianDateTimeString(row.createdAt),
      updatedAt: row.updatedAt,
      updatedAtFa: this.toPersianDateTimeString(row.updatedAt),
      deletedAt: row.deletedAt,
      deletedAtFa: this.toPersianDateTimeString(row.deletedAt),
    };
  }
}
