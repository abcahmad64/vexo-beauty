import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import {
  CouponType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  StockMovementType,
} from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CreateOrderDto } from '../dto/create-order.dto';

import {
  CheckoutAddressDto,
  CreateOrderFromCartDto,
} from '../dto/create-order-from-cart.dto';

import { OrderItemDto } from '../dto/order-item.dto';

import { QueryOrderDto } from '../dto/query-order.dto';

import { UpdateOrderDto } from '../dto/update-order.dto';

import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';

import { OrderEventPublisher } from '../events/order.event.publisher';

type PrismaTx = Prisma.TransactionClient;

type CountRow = {
  count: number | bigint;
};

type OrderRow = {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: unknown;
  tax_amount: unknown;
  shipping_amount: unknown;
  discount_amount: unknown;
  total_amount: unknown;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  shipping_address_id: string | null;
  billing_address_id: string | null;
  shipping_method: string | null;
  tracking_number: string | null;
  notes: string | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number | bigint;
  price: unknown;
  product_name: string;
  sku: string;
  discount: unknown;
  created_at: Date;
  updated_at: Date;
};

type ProductForOrderRow = {
  product_id: string;
  product_name: string;
  product_slug: string;
  product_sku: string;
  product_price: unknown;
  product_compare_price: unknown;
  product_is_active: boolean;
  product_status: string;
  variant_id: string | null;
  variant_sku: string | null;
  variant_name: string | null;
  variant_price: unknown;
  variant_is_active: boolean | null;
  available_stock: number | bigint | null;
};

type CartItemRow = {
  product_id: string;
  variant_id: string | null;
  quantity: number | bigint;
};

type CouponRow = {
  id: string;
  code: string;
  type: CouponType;
  value: unknown;
  usage_limit: number | bigint | null;
  used_count: number | bigint;
  start_date: Date;
  end_date: Date | null;
  min_amount: unknown;
};

type InventoryAllocationRow = {
  id: string;
  quantity: number | bigint;
  reserved_quantity: number | bigint;
  available_quantity: number | bigint;
};

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: OrderEventPublisher,
  ) {}

  async create(userId: string, dto: CreateOrderDto, actorId?: string) {
    const order = await this.createFromItems(
      userId,
      dto.items,
      dto,
      actorId ?? userId,
    );

    return this.findOneForUser(userId, order.id);
  }

  async createFromCart(
    userId: string,
    dto: CreateOrderFromCartDto,
    actorId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // The cart row lock serializes checkout for one customer until
      // order creation, stock reservation, and cart clearing all commit.
      const cartRows = await tx.$queryRaw<
        Array<{
          id: string;
        }>
      >(
        Prisma.sql`
                SELECT "id"
                FROM "Cart"
                WHERE "userId" = ${userId}
                FOR UPDATE
              `,
      );

      if (!cartRows[0]) {
        throw new BadRequestException('سبد خرید خالی است.');
      }

      const cartItems = await this.getCartItemsTx(tx, userId);

      if (cartItems.length === 0) {
        throw new BadRequestException('سبد خرید خالی است.');
      }

      const items: OrderItemDto[] = cartItems.map((item) => ({
        productId: item.product_id,
        variantId: item.variant_id ?? undefined,
        quantity: this.toNumber(item.quantity),
      }));

      const order = await this.createFromItems(
        userId,
        items,
        dto,
        actorId ?? userId,
        tx,
      );

      await tx.cartItem.deleteMany({
        where: {
          cart: {
            userId,
          },
        },
      });

      return {
        order,
        itemsCount: items.length,
      };
    });

    this.publishCreatedOrder(
      result.order,
      result.itemsCount,
      actorId ?? userId,
    );

    return this.findOneForUser(userId, result.order.id);
  }

  async findAllForAdmin(query: QueryOrderDto) {
    const { page, limit, skip } = this.buildPagination(query);

    const whereSql = this.buildOrderWhereSql(query);

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<OrderRow[]>(
        Prisma.sql`
            SELECT
              o."id",
              o."userId" AS user_id,
              o."orderNumber" AS order_number,
              o."status",
              o."subtotal",
              o."taxAmount" AS tax_amount,
              o."shippingAmount" AS shipping_amount,
              o."discountAmount" AS discount_amount,
              o."totalAmount" AS total_amount,
              o."currency",
              o."paymentStatus" AS payment_status,
              o."paymentMethod" AS payment_method,
              o."shippingAddressId" AS shipping_address_id,
              o."billingAddressId" AS billing_address_id,
              o."shippingMethod" AS shipping_method,
              o."trackingNumber" AS tracking_number,
              o."notes",
              o."shippedAt" AS shipped_at,
              o."deliveredAt" AS delivered_at,
              o."cancelledAt" AS cancelled_at,
              o."createdAt" AS created_at,
              o."updatedAt" AS updated_at,
              o."deleted_at" AS deleted_at
            FROM "Order" o
            ${whereSql}
            ORDER BY o."createdAt" DESC, o."id" DESC
            LIMIT ${limit}
            OFFSET ${skip}
          `,
      ),

      this.prisma.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Order" o
            ${whereSql}
          `,
      ),
    ]);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapOrderRow(row)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async findAllForUser(userId: string, query: QueryOrderDto) {
    return this.findAllForAdmin({
      ...query,
      userId,
      includeDeleted: false,
    });
  }

  async findOneForAdmin(orderId: string) {
    const order = await this.findOrderRow(orderId);

    const items = await this.getOrderItems(order.id);

    return {
      ...this.mapOrderRow(order),
      items: items.map((item) => this.mapOrderItemRow(item)),
    };
  }

  async findOneForUser(userId: string, orderId: string) {
    const order = await this.findOrderRow(orderId);

    if (order.user_id !== userId) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const items = await this.getOrderItems(order.id);

    return {
      ...this.mapOrderRow(order),
      items: items.map((item) => this.mapOrderItemRow(item)),
    };
  }

  async update(orderId: string, dto: UpdateOrderDto, actorId?: string) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'هیچ فیلدی برای ویرایش سفارش ارسال نشده است.',
      );
    }

    const current = await this.findOrderRow(orderId);

    this.assertOrderEditable(current.status);

    if (dto.shippingAddressId) {
      await this.assertAddressBelongsToUser(
        current.user_id,
        dto.shippingAddressId,
      );
    }

    if (dto.billingAddressId) {
      await this.assertAddressBelongsToUser(
        current.user_id,
        dto.billingAddressId,
      );
    }

    const updates: Prisma.Sql[] = [];

    if (dto.shippingAddressId !== undefined) {
      updates.push(Prisma.sql`"shippingAddressId" = ${dto.shippingAddressId}`);
    }

    if (dto.billingAddressId !== undefined) {
      updates.push(Prisma.sql`"billingAddressId" = ${dto.billingAddressId}`);
    }

    if (dto.shippingMethod !== undefined) {
      updates.push(Prisma.sql`"shippingMethod" = ${dto.shippingMethod}`);
    }

    if (dto.trackingNumber !== undefined) {
      updates.push(Prisma.sql`"trackingNumber" = ${dto.trackingNumber}`);
    }

    if (dto.paymentMethod !== undefined) {
      updates.push(
        Prisma.sql`"paymentMethod" = ${dto.paymentMethod}::"PaymentMethod"`,
      );
    }

    if (dto.notes !== undefined) {
      updates.push(Prisma.sql`"notes" = ${dto.notes}`);
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          ${Prisma.join(updates, ', ')},
          "updatedAt" = NOW()
        WHERE "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishUpdated({
      orderId: current.id,
      orderNumber: current.order_number,
      userId: current.user_id,
      changedFields: Object.keys(dto),
      actorId,
      occurredAt: new Date(),
    });

    return this.findOneForAdmin(orderId);
  }

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    actorId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await this.findOrderRowForUpdate(tx, orderId);

      if (current.status === dto.status) {
        return {
          current,
          previousStatus: current.status,
          stockReleased: false,
          stockCommitted: false,
        };
      }

      this.assertStatusTransition(current.status, dto.status);

      let stockReleased = false;

      let stockCommitted = false;

      if (dto.status === OrderStatus.CANCELLED) {
        await this.releaseReservedStockForOrderTx(
          tx,
          current.id,
          current.order_number,
        );

        stockReleased = true;
      }

      if (dto.status === OrderStatus.PROCESSING) {
        await this.commitReservedStockForOrderTx(
          tx,
          current.id,
          current.order_number,
        );

        stockCommitted = true;
      }

      const updates: Prisma.Sql[] = [
        Prisma.sql`"status" = ${dto.status}::"OrderStatus"`,
        Prisma.sql`"updatedAt" = NOW()`,
      ];

      if (dto.status === OrderStatus.CANCELLED) {
        updates.push(Prisma.sql`"cancelledAt" = NOW()`);
      }

      if (dto.status === OrderStatus.SHIPPED) {
        updates.push(Prisma.sql`"shippedAt" = NOW()`);
      }

      if (dto.status === OrderStatus.DELIVERED) {
        updates.push(Prisma.sql`"deliveredAt" = NOW()`);
      }

      await tx.$executeRaw(
        Prisma.sql`
              UPDATE "Order"
              SET ${Prisma.join(updates, ', ')}
              WHERE "id" = ${current.id}
                AND "deleted_at" IS NULL
            `,
      );

      return {
        current,
        previousStatus: current.status,
        stockReleased,
        stockCommitted,
      };
    });

    this.eventPublisher.publishStatusChanged({
      orderId: result.current.id,
      orderNumber: result.current.order_number,
      userId: result.current.user_id,
      previousStatus: result.previousStatus,
      currentStatus: dto.status,
      reason: dto.reason,
      actorId,
      occurredAt: new Date(),
    });

    if (dto.status === OrderStatus.CANCELLED) {
      this.eventPublisher.publishCancelled({
        orderId: result.current.id,
        orderNumber: result.current.order_number,
        userId: result.current.user_id,
        previousStatus: result.previousStatus,
        reason: dto.reason,
        actorId,
        occurredAt: new Date(),
      });
    }

    if (result.stockReleased) {
      this.eventPublisher.publishStockReleased({
        orderId: result.current.id,
        orderNumber: result.current.order_number,
        userId: result.current.user_id,
        itemsCount: await this.countOrderItems(result.current.id),
        actorId,
        occurredAt: new Date(),
      });
    }

    if (result.stockCommitted) {
      this.eventPublisher.publishStockCommitted({
        orderId: result.current.id,
        orderNumber: result.current.order_number,
        userId: result.current.user_id,
        itemsCount: await this.countOrderItems(result.current.id),
        actorId,
        occurredAt: new Date(),
      });
    }

    return this.findOneForAdmin(orderId);
  }

  async cancelForUser(userId: string, orderId: string, reason?: string) {
    const order = await this.findOrderRow(orderId);

    if (order.user_id !== userId) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        'فقط سفارش‌های در انتظار یا تاییدشده توسط مشتری قابل لغو هستند.',
      );
    }

    return this.updateStatus(
      orderId,
      {
        status: OrderStatus.CANCELLED,
        reason,
      },
      userId,
    );
  }

  async remove(orderId: string, actorId?: string) {
    const order = await this.findOrderRow(orderId);

    const deletableStatuses: OrderStatus[] = [
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ];

    if (!deletableStatuses.includes(order.status)) {
      throw new BadRequestException(
        'فقط سفارش‌های لغوشده یا مرجوع‌شده قابل حذف هستند.',
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Order"
        SET
          "deleted_at" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${orderId}
          AND "deleted_at" IS NULL
      `,
    );

    this.eventPublisher.publishDeleted({
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      actorId,
      occurredAt: new Date(),
    });

    return {
      success: true,
      message: 'سفارش با موفقیت حذف شد.',
    };
  }

  private async createFromItems(
    userId: string,
    items: OrderItemDto[],
    dto: CreateOrderDto | CreateOrderFromCartDto,
    actorId?: string,
    transaction?: PrismaTx,
  ): Promise<OrderRow> {
    if (items.length === 0) {
      throw new BadRequestException('سفارش باید حداقل یک آیتم داشته باشد.');
    }

    const isCartCheckout = this.isCreateOrderFromCartDto(dto);

    const createOrder = async (tx: PrismaTx): Promise<OrderRow> => {
      await this.assertUserExists(tx, userId);

      const { shippingAddressId, billingAddressId } =
        await this.resolveCheckoutAddressesTx(tx, userId, dto);

      const preparedItems = await this.prepareOrderItemsTx(tx, items);

      const subtotal = preparedItems.reduce(
        (sum, item) =>
          sum.plus(item.price.minus(item.discount).mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      // Monetary totals for customer checkout are server-owned.
      const taxAmount = new Prisma.Decimal(
        isCartCheckout ? 0 : (dto.taxAmount ?? 0),
      );

      let shippingAmount = new Prisma.Decimal(
        isCartCheckout ? 0 : (dto.shippingAmount ?? 0),
      );

      let discountAmount = new Prisma.Decimal(0);

      let coupon: CouponRow | null = null;

      if (dto.couponCode) {
        coupon = await this.findValidCouponTx(
          tx,
          dto.couponCode,
          userId,
          subtotal,
        );

        const couponDiscount = this.calculateCouponDiscount(
          coupon,
          subtotal,
          shippingAmount,
        );

        discountAmount = discountAmount.plus(couponDiscount.discountAmount);

        shippingAmount = couponDiscount.shippingAmount;
      }

      const totalAmount = subtotal
        .plus(taxAmount)
        .plus(shippingAmount)
        .minus(discountAmount);

      if (totalAmount.lessThan(0)) {
        throw new BadRequestException('مبلغ نهایی سفارش نمی‌تواند منفی باشد.');
      }

      const orderId = randomUUID();

      const orderNumber = await this.generateOrderNumberTx(tx);

      const orderRows = await tx.$queryRaw<OrderRow[]>(
        Prisma.sql`
                INSERT INTO "Order" (
                  "id",
                  "userId",
                  "orderNumber",
                  "status",
                  "subtotal",
                  "taxAmount",
                  "shippingAmount",
                  "discountAmount",
                  "totalAmount",
                  "currency",
                  "paymentStatus",
                  "paymentMethod",
                  "shippingAddressId",
                  "billingAddressId",
                  "shippingMethod",
                  "notes",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  ${orderId},
                  ${userId},
                  ${orderNumber},
                  ${OrderStatus.PENDING}::"OrderStatus",
                  ${subtotal},
                  ${taxAmount},
                  ${shippingAmount},
                  ${discountAmount},
                  ${totalAmount},
                  ${isCartCheckout ? 'IRR' : (dto.currency ?? 'IRR')},
                  ${PaymentStatus.PENDING}::"PaymentStatus",
                  ${dto.paymentMethod ?? null}::"PaymentMethod",
                  ${shippingAddressId},
                  ${billingAddressId},
                  ${dto.shippingMethod ?? null},
                  ${dto.notes ?? null},
                  NOW(),
                  NOW()
                )
                RETURNING
                  "id",
                  "userId" AS user_id,
                  "orderNumber" AS order_number,
                  "status",
                  "subtotal",
                  "taxAmount" AS tax_amount,
                  "shippingAmount" AS shipping_amount,
                  "discountAmount" AS discount_amount,
                  "totalAmount" AS total_amount,
                  "currency",
                  "paymentStatus" AS payment_status,
                  "paymentMethod" AS payment_method,
                  "shippingAddressId" AS shipping_address_id,
                  "billingAddressId" AS billing_address_id,
                  "shippingMethod" AS shipping_method,
                  "trackingNumber" AS tracking_number,
                  "notes",
                  "shippedAt" AS shipped_at,
                  "deliveredAt" AS delivered_at,
                  "cancelledAt" AS cancelled_at,
                  "createdAt" AS created_at,
                  "updatedAt" AS updated_at,
                  "deleted_at" AS deleted_at
              `,
      );

      const order = orderRows[0];

      for (const item of preparedItems) {
        await tx.$executeRaw(
          Prisma.sql`
                INSERT INTO "OrderItem" (
                  "id",
                  "orderId",
                  "productId",
                  "variantId",
                  "quantity",
                  "price",
                  "productName",
                  "sku",
                  "discount",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  ${randomUUID()},
                  ${order.id},
                  ${item.productId},
                  ${item.variantId ?? null},
                  ${item.quantity},
                  ${item.price},
                  ${item.productName},
                  ${item.sku},
                  ${item.discount},
                  NOW(),
                  NOW()
                )
              `,
        );

        if (item.variantId) {
          await this.reserveVariantStockTx(tx, item.variantId, item.quantity);
        }
      }

      if (coupon) {
        await tx.$executeRaw(
          Prisma.sql`
                INSERT INTO "CouponUsage" (
                  "id",
                  "couponId",
                  "orderId",
                  "userId",
                  "usedAt",
                  "createdAt",
                  "updatedAt"
                )
                VALUES (
                  ${randomUUID()},
                  ${coupon.id},
                  ${order.id},
                  ${userId},
                  NOW(),
                  NOW(),
                  NOW()
                )
              `,
        );

        await tx.$executeRaw(
          Prisma.sql`
                UPDATE "Coupon"
                SET
                  "usedCount" = "usedCount" + 1,
                  "updatedAt" = NOW()
                WHERE "id" = ${coupon.id}
              `,
        );
      }

      return order;
    };

    const order = transaction
      ? await createOrder(transaction)
      : await this.prisma.$transaction(createOrder);

    if (!transaction) {
      this.publishCreatedOrder(order, items.length, actorId);
    }

    return order;
  }

  private publishCreatedOrder(
    order: OrderRow,
    itemsCount: number,
    actorId?: string,
  ): void {
    this.eventPublisher.publishCreated({
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      totalAmount: this.toDecimalString(order.total_amount),
      currency: order.currency,
      itemsCount,
      actorId,
      occurredAt: new Date(),
    });

    this.eventPublisher.publishStockReserved({
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      itemsCount,
      actorId,
      occurredAt: new Date(),
    });
  }

  private async resolveCheckoutAddressesTx(
    tx: PrismaTx,
    userId: string,
    dto: CreateOrderDto | CreateOrderFromCartDto,
  ): Promise<{
    shippingAddressId: string | null;
    billingAddressId: string | null;
  }> {
    let shippingAddressId = dto.shippingAddressId ?? null;

    let billingAddressId = dto.billingAddressId ?? null;

    const isFromCart = this.isCreateOrderFromCartDto(dto);

    if (isFromCart && dto.shippingAddressId && dto.shippingAddress) {
      throw new BadRequestException(
        'همزمان نمی‌توان شناسه آدرس ارسال و آدرس ارسال جدید را ارسال کرد.',
      );
    }

    if (isFromCart && dto.billingAddressId && dto.billingAddress) {
      throw new BadRequestException(
        'همزمان نمی‌توان شناسه آدرس صورتحساب و آدرس صورتحساب جدید را ارسال کرد.',
      );
    }

    if (shippingAddressId) {
      await this.assertAddressBelongsToUserTx(tx, userId, shippingAddressId);
    }

    if (billingAddressId) {
      await this.assertAddressBelongsToUserTx(tx, userId, billingAddressId);
    }

    if (isFromCart && dto.shippingAddress) {
      shippingAddressId = await this.createCheckoutAddressTx(
        tx,
        userId,
        dto.shippingAddress,
        'آدرس ارسال',
      );

      await this.updateUserProfileFromAddressTx(
        tx,
        userId,
        dto.shippingAddress,
      );
    }

    if (isFromCart && dto.billingAddress) {
      billingAddressId = await this.createCheckoutAddressTx(
        tx,
        userId,
        dto.billingAddress,
        'آدرس صورتحساب',
      );
    }

    if (
      isFromCart &&
      dto.useShippingAsBilling !== false &&
      shippingAddressId &&
      !billingAddressId
    ) {
      billingAddressId = shippingAddressId;
    }

    if (isFromCart && !shippingAddressId) {
      throw new BadRequestException('برای ثبت سفارش، آدرس ارسال الزامی است.');
    }

    return {
      shippingAddressId,
      billingAddressId,
    };
  }

  private isCreateOrderFromCartDto(
    dto: CreateOrderDto | CreateOrderFromCartDto,
  ): dto is CreateOrderFromCartDto {
    return !('items' in dto);
  }

  private async createCheckoutAddressTx(
    tx: PrismaTx,
    userId: string,
    address: CheckoutAddressDto,
    fallbackTitle: string,
  ): Promise<string> {
    const addressId = randomUUID();

    const shouldSetDefault =
      address.setAsDefault === true ||
      (await this.userHasNoAddressTx(tx, userId));

    if (shouldSetDefault) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "Address"
          SET
            "isDefault" = false,
            "updatedAt" = NOW()
          WHERE "userId" = ${userId}
            AND "deleted_at" IS NULL
        `,
      );
    }

    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO "Address" (
          "id",
          "userId",
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
        )
        VALUES (
          ${addressId},
          ${userId},
          ${address.title ?? fallbackTitle},
          ${address.firstName},
          ${address.lastName},
          ${address.phone},
          ${address.country ?? 'ایران'},
          ${address.state ?? null},
          ${address.city},
          ${address.postalCode ?? null},
          ${address.street},
          ${address.apartment ?? null},
          ${shouldSetDefault},
          NOW(),
          NOW()
        )
      `,
    );

    return addressId;
  }

  private async updateUserProfileFromAddressTx(
    tx: PrismaTx,
    userId: string,
    address: CheckoutAddressDto,
  ) {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE "User"
        SET
          "firstName" = CASE
            WHEN "firstName" IS NULL OR TRIM("firstName") = ''
              THEN ${address.firstName}
            ELSE "firstName"
          END,
          "lastName" = CASE
            WHEN "lastName" IS NULL OR TRIM("lastName") = ''
              THEN ${address.lastName}
            ELSE "lastName"
          END,
          "updatedAt" = NOW()
        WHERE "id" = ${userId}
          AND "deleted_at" IS NULL
      `,
    );
  }

  private async userHasNoAddressTx(
    tx: PrismaTx,
    userId: string,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Address"
          WHERE "userId" = ${userId}
            AND "deleted_at" IS NULL
        `,
    );

    return this.toNumber(rows[0]?.count) === 0;
  }

  private async prepareOrderItemsTx(tx: PrismaTx, items: OrderItemDto[]) {
    const prepared: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      price: Prisma.Decimal;
      discount: Prisma.Decimal;
      productName: string;
      sku: string;
    }> = [];

    for (const item of items) {
      const product = await this.getProductForOrderTx(
        tx,
        item.productId,
        item.variantId,
      );

      this.assertProductPurchasable(product);

      const quantity = item.quantity;

      if (product.variant_id) {
        const available = this.toNumber(product.available_stock);

        if (quantity > available) {
          throw new BadRequestException(
            `موجودی محصول ${product.product_name} کافی نیست.`,
          );
        }
      }

      prepared.push({
        productId: product.product_id,
        variantId: product.variant_id,
        quantity,
        price: this.resolveUnitPrice(product),
        discount: new Prisma.Decimal(0),
        productName: product.product_name,
        sku: product.variant_sku ?? product.product_sku,
      });
    }

    return prepared;
  }

  private async getProductForOrderTx(
    tx: PrismaTx,
    productId: string,
    variantId?: string,
  ): Promise<ProductForOrderRow> {
    const rows = await tx.$queryRaw<ProductForOrderRow[]>(
      Prisma.sql`
          SELECT
            p."id" AS product_id,
            p."name" AS product_name,
            p."slug" AS product_slug,
            p."sku" AS product_sku,
            p."price" AS product_price,
            p."comparePrice" AS product_compare_price,
            p."isActive" AS product_is_active,
            p."status"::text AS product_status,
            pv."id" AS variant_id,
            pv."sku" AS variant_sku,
            pv."name" AS variant_name,
            pv."price" AS variant_price,
            pv."isActive" AS variant_is_active,
            COALESCE(stock.available_stock, 0)::int AS available_stock
          FROM "Product" p
          LEFT JOIN "ProductVariant" pv
            ON pv."productId" = p."id"
            ${
              variantId
                ? Prisma.sql`AND pv."id" = ${variantId}`
                : Prisma.sql`AND pv."deleted_at" IS NULL AND pv."isActive" = true`
            }
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(
                SUM(
                  GREATEST(
                    COALESCE(i."quantity", 0) -
                    COALESCE(i."reservedQuantity", 0),
                    0
                  )
                ),
                0
              ) AS available_stock
            FROM "Inventory" i
            WHERE ${
              variantId
                ? Prisma.sql`i."variantId" = ${variantId}`
                : Prisma.sql`i."variantId" = pv."id"`
            }
          ) stock ON true
          WHERE p."id" = ${productId}
            AND p."deleted_at" IS NULL
          ORDER BY pv."createdAt" ASC NULLS LAST
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product) {
      throw new NotFoundException('محصول پیدا نشد.');
    }

    if (variantId && !product.variant_id) {
      throw new NotFoundException('تنوع محصول پیدا نشد.');
    }

    return product;
  }

  private assertProductPurchasable(product: ProductForOrderRow) {
    if (
      product.product_is_active !== true ||
      product.product_status !== 'ACTIVE'
    ) {
      throw new BadRequestException(
        `محصول ${product.product_name} قابل خرید نیست.`,
      );
    }

    if (product.variant_id && product.variant_is_active === false) {
      throw new BadRequestException(
        `تنوع انتخاب‌شده برای محصول ${product.product_name} فعال نیست.`,
      );
    }
  }

  private resolveUnitPrice(product: ProductForOrderRow): Prisma.Decimal {
    if (product.variant_price !== null && product.variant_price !== undefined) {
      return this.toDecimal(product.variant_price);
    }

    return this.toDecimal(product.product_price);
  }

  private async reserveVariantStockTx(
    tx: PrismaTx,
    variantId: string,
    quantity: number,
  ) {
    let remaining = quantity;

    const rows = await tx.$queryRaw<InventoryAllocationRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "quantity",
            "reservedQuantity" AS reserved_quantity,
            GREATEST(
              "quantity" - "reservedQuantity",
              0
            )::int AS available_quantity
          FROM "Inventory"
          WHERE "variantId" = ${variantId}
            AND GREATEST(
              "quantity" - "reservedQuantity",
              0
            ) > 0
          ORDER BY available_quantity DESC, "updatedAt" ASC
          FOR UPDATE
        `,
    );

    const totalAvailable = rows.reduce(
      (sum, row) => sum + this.toNumber(row.available_quantity),
      0,
    );

    if (totalAvailable < quantity) {
      throw new BadRequestException('موجودی کافی نیست.');
    }

    for (const row of rows) {
      if (remaining <= 0) {
        break;
      }

      const available = this.toNumber(row.available_quantity);

      const reserveQuantity = Math.min(remaining, available);

      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "Inventory"
          SET
            "reservedQuantity" = "reservedQuantity" + ${reserveQuantity},
            "updatedAt" = NOW()
          WHERE "id" = ${row.id}
        `,
      );

      remaining -= reserveQuantity;
    }
  }

  private async releaseReservedStockForOrderTx(
    tx: PrismaTx,
    orderId: string,
    reference: string,
  ) {
    const items = await this.getOrderItemsTx(tx, orderId);

    for (const item of items) {
      if (!item.variant_id) {
        continue;
      }

      let remaining = this.toNumber(item.quantity);

      const rows = await tx.$queryRaw<InventoryAllocationRow[]>(
        Prisma.sql`
            SELECT
              "id",
              "quantity",
              "reservedQuantity" AS reserved_quantity,
              "reservedQuantity" AS available_quantity
            FROM "Inventory"
            WHERE "variantId" = ${item.variant_id}
              AND "reservedQuantity" > 0
            ORDER BY "updatedAt" DESC
            FOR UPDATE
          `,
      );

      for (const row of rows) {
        if (remaining <= 0) {
          break;
        }

        const reserved = this.toNumber(row.reserved_quantity);

        const releaseQuantity = Math.min(remaining, reserved);

        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "Inventory"
            SET
              "reservedQuantity" = "reservedQuantity" - ${releaseQuantity},
              "updatedAt" = NOW()
            WHERE "id" = ${row.id}
          `,
        );

        remaining -= releaseQuantity;
      }
    }

    void reference;
  }

  private async commitReservedStockForOrderTx(
    tx: PrismaTx,
    orderId: string,
    reference: string,
  ) {
    const items = await this.getOrderItemsTx(tx, orderId);

    for (const item of items) {
      if (!item.variant_id) {
        continue;
      }

      let remaining = this.toNumber(item.quantity);

      const rows = await tx.$queryRaw<InventoryAllocationRow[]>(
        Prisma.sql`
            SELECT
              "id",
              "quantity",
              "reservedQuantity" AS reserved_quantity,
              "reservedQuantity" AS available_quantity
            FROM "Inventory"
            WHERE "variantId" = ${item.variant_id}
              AND "reservedQuantity" > 0
            ORDER BY "updatedAt" ASC
            FOR UPDATE
          `,
      );

      const totalReserved = rows.reduce(
        (sum, row) => sum + this.toNumber(row.reserved_quantity),
        0,
      );

      if (totalReserved < remaining) {
        throw new BadRequestException(
          'موجودی رزروشده برای پردازش سفارش کافی نیست.',
        );
      }

      for (const row of rows) {
        if (remaining <= 0) {
          break;
        }

        const reserved = this.toNumber(row.reserved_quantity);

        const commitQuantity = Math.min(remaining, reserved);

        await tx.$executeRaw(
          Prisma.sql`
            UPDATE "Inventory"
            SET
              "quantity" = "quantity" - ${commitQuantity},
              "reservedQuantity" = "reservedQuantity" - ${commitQuantity},
              "updatedAt" = NOW()
            WHERE "id" = ${row.id}
          `,
        );

        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO "StockMovement" (
              "id",
              "inventoryId",
              "type",
              "quantity",
              "reason",
              "reference",
              "createdAt"
            )
            VALUES (
              ${randomUUID()},
              ${row.id},
              ${StockMovementType.OUT}::"StockMovementType",
              ${commitQuantity},
              ${'Order stock committed'},
              ${reference},
              NOW()
            )
          `,
        );

        remaining -= commitQuantity;
      }
    }
  }

  private async findValidCouponTx(
    tx: PrismaTx,
    code: string,
    userId: string,
    subtotal: Prisma.Decimal,
  ): Promise<CouponRow> {
    const rows = await tx.$queryRaw<CouponRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "code",
            "type",
            "value",
            "usageLimit" AS usage_limit,
            "usedCount" AS used_count,
            "startDate" AS start_date,
            "endDate" AS end_date,
            "minAmount" AS min_amount
          FROM "Coupon"
          WHERE LOWER("code") = LOWER(${code})
            AND "deleted_at" IS NULL
            AND "isActive" = true
            AND "status"::text = 'ACTIVE'
          LIMIT 1
        `,
    );

    const coupon = rows[0];

    if (!coupon) {
      throw new BadRequestException('کد تخفیف معتبر نیست.');
    }

    const now = new Date();

    if (coupon.start_date.getTime() > now.getTime()) {
      throw new BadRequestException('کد تخفیف هنوز فعال نشده است.');
    }

    if (coupon.end_date && coupon.end_date.getTime() < now.getTime()) {
      throw new BadRequestException('کد تخفیف منقضی شده است.');
    }

    if (
      coupon.usage_limit !== null &&
      this.toNumber(coupon.used_count) >= this.toNumber(coupon.usage_limit)
    ) {
      throw new BadRequestException('ظرفیت استفاده از کد تخفیف تکمیل شده است.');
    }

    if (
      coupon.min_amount &&
      subtotal.lessThan(this.toDecimal(coupon.min_amount))
    ) {
      throw new BadRequestException(
        'مبلغ سفارش کمتر از حداقل مبلغ مجاز برای این کد تخفیف است.',
      );
    }

    const usageRows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "CouponUsage"
          WHERE "couponId" = ${coupon.id}
            AND "userId" = ${userId}
        `,
    );

    if (this.toNumber(usageRows[0]?.count) > 0) {
      throw new BadRequestException(
        'این کد تخفیف قبلاً توسط شما استفاده شده است.',
      );
    }

    return coupon;
  }

  private calculateCouponDiscount(
    coupon: CouponRow,
    subtotal: Prisma.Decimal,
    shippingAmount: Prisma.Decimal,
  ) {
    if (coupon.type === CouponType.PERCENTAGE) {
      const discountAmount = subtotal
        .mul(this.toDecimal(coupon.value))
        .div(100);

      return {
        discountAmount,
        shippingAmount,
      };
    }

    if (coupon.type === CouponType.FIXED_AMOUNT) {
      const value = this.toDecimal(coupon.value);

      return {
        discountAmount: Prisma.Decimal.min(value, subtotal),
        shippingAmount,
      };
    }

    if (coupon.type === CouponType.FREE_SHIPPING) {
      return {
        discountAmount: new Prisma.Decimal(0),
        shippingAmount: new Prisma.Decimal(0),
      };
    }

    return {
      discountAmount: new Prisma.Decimal(0),
      shippingAmount,
    };
  }

  private async getCartItemsTx(
    tx: PrismaTx,
    userId: string,
  ): Promise<CartItemRow[]> {
    return tx.$queryRaw<CartItemRow[]>(
      Prisma.sql`
        SELECT
          ci."productId" AS product_id,
          ci."variantId" AS variant_id,
          ci."quantity"
        FROM "Cart" c
        INNER JOIN "CartItem" ci ON ci."cartId" = c."id"
        WHERE c."userId" = ${userId}
        ORDER BY ci."createdAt" ASC
      `,
    );
  }

  private async findOrderRow(orderId: string): Promise<OrderRow> {
    const rows = await this.prisma.$queryRaw<OrderRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."userId" AS user_id,
            o."orderNumber" AS order_number,
            o."status",
            o."subtotal",
            o."taxAmount" AS tax_amount,
            o."shippingAmount" AS shipping_amount,
            o."discountAmount" AS discount_amount,
            o."totalAmount" AS total_amount,
            o."currency",
            o."paymentStatus" AS payment_status,
            o."paymentMethod" AS payment_method,
            o."shippingAddressId" AS shipping_address_id,
            o."billingAddressId" AS billing_address_id,
            o."shippingMethod" AS shipping_method,
            o."trackingNumber" AS tracking_number,
            o."notes",
            o."shippedAt" AS shipped_at,
            o."deliveredAt" AS delivered_at,
            o."cancelledAt" AS cancelled_at,
            o."createdAt" AS created_at,
            o."updatedAt" AS updated_at,
            o."deleted_at" AS deleted_at
          FROM "Order" o
          WHERE o."id" = ${orderId}
            AND o."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    return rows[0];
  }

  private async findOrderRowForUpdate(
    tx: PrismaTx,
    orderId: string,
  ): Promise<OrderRow> {
    const rows = await tx.$queryRaw<OrderRow[]>(
      Prisma.sql`
          SELECT
            o."id",
            o."userId" AS user_id,
            o."orderNumber" AS order_number,
            o."status",
            o."subtotal",
            o."taxAmount" AS tax_amount,
            o."shippingAmount" AS shipping_amount,
            o."discountAmount" AS discount_amount,
            o."totalAmount" AS total_amount,
            o."currency",
            o."paymentStatus" AS payment_status,
            o."paymentMethod" AS payment_method,
            o."shippingAddressId" AS shipping_address_id,
            o."billingAddressId" AS billing_address_id,
            o."shippingMethod" AS shipping_method,
            o."trackingNumber" AS tracking_number,
            o."notes",
            o."shippedAt" AS shipped_at,
            o."deliveredAt" AS delivered_at,
            o."cancelledAt" AS cancelled_at,
            o."createdAt" AS created_at,
            o."updatedAt" AS updated_at,
            o."deleted_at" AS deleted_at
          FROM "Order" o
          WHERE o."id" = ${orderId}
            AND o."deleted_at" IS NULL
          LIMIT 1
          FOR UPDATE
        `,
    );

    if (!rows[0]) {
      throw new NotFoundException('سفارش پیدا نشد.');
    }

    return rows[0];
  }

  private async getOrderItems(orderId: string): Promise<OrderItemRow[]> {
    return this.prisma.$queryRaw<OrderItemRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "orderId" AS order_id,
          "productId" AS product_id,
          "variantId" AS variant_id,
          "quantity",
          "price",
          "productName" AS product_name,
          "sku",
          "discount",
          "createdAt" AS created_at,
          "updatedAt" AS updated_at
        FROM "OrderItem"
        WHERE "orderId" = ${orderId}
        ORDER BY "createdAt" ASC
      `,
    );
  }

  private async getOrderItemsTx(
    tx: PrismaTx,
    orderId: string,
  ): Promise<OrderItemRow[]> {
    return tx.$queryRaw<OrderItemRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "orderId" AS order_id,
          "productId" AS product_id,
          "variantId" AS variant_id,
          "quantity",
          "price",
          "productName" AS product_name,
          "sku",
          "discount",
          "createdAt" AS created_at,
          "updatedAt" AS updated_at
        FROM "OrderItem"
        WHERE "orderId" = ${orderId}
        ORDER BY "createdAt" ASC
      `,
    );
  }

  private async countOrderItems(orderId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "OrderItem"
          WHERE "orderId" = ${orderId}
        `,
    );

    return this.toNumber(rows[0]?.count);
  }

  private async assertUserExists(tx: PrismaTx, userId: string) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE "id" = ${userId}
            AND "deleted_at" IS NULL
            AND "status"::text = 'ACTIVE'
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException('کاربر پیدا نشد یا حساب کاربری فعال نیست.');
    }
  }

  private async assertAddressBelongsToUser(userId: string, addressId: string) {
    await this.assertAddressBelongsToUserTx(this.prisma, userId, addressId);
  }

  private async assertAddressBelongsToUserTx(
    tx: PrismaTx | PrismaService,
    userId: string,
    addressId: string,
  ) {
    const rows = await tx.$queryRaw<CountRow[]>(
      Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "Address"
          WHERE "id" = ${addressId}
            AND "userId" = ${userId}
            AND "deleted_at" IS NULL
        `,
    );

    if (this.toNumber(rows[0]?.count) === 0) {
      throw new BadRequestException('آدرس پیدا نشد.');
    }
  }

  private async generateOrderNumberTx(tx: PrismaTx): Promise<string> {
    const date = new Date();

    const yyyy = date.getFullYear();

    const mm = String(date.getMonth() + 1).padStart(2, '0');

    const dd = String(date.getDate()).padStart(2, '0');

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();

      const orderNumber = `ORD-${yyyy}${mm}${dd}-${random}`;

      const rows = await tx.$queryRaw<CountRow[]>(
        Prisma.sql`
            SELECT COUNT(*)::int AS count
            FROM "Order"
            WHERE "orderNumber" = ${orderNumber}
          `,
      );

      if (this.toNumber(rows[0]?.count) === 0) {
        return orderNumber;
      }
    }

    throw new BadRequestException('امکان ساخت شماره سفارش یکتا وجود ندارد.');
  }

  private assertOrderEditable(status: OrderStatus) {
    const editableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
    ];

    if (!editableStatuses.includes(status)) {
      throw new BadRequestException('این سفارش دیگر قابل ویرایش نیست.');
    }
  }

  private assertStatusTransition(current: OrderStatus, next: OrderStatus) {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.CONFIRMED,
        OrderStatus.PROCESSING,
        OrderStatus.CANCELLED,
      ],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `تغییر وضعیت سفارش از ${current} به ${next} مجاز نیست.`,
      );
    }
  }

  private buildOrderWhereSql(query: QueryOrderDto): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.includeDeleted !== true) {
      conditions.push(Prisma.sql`o."deleted_at" IS NULL`);
    }

    if (query.userId) {
      conditions.push(Prisma.sql`o."userId" = ${query.userId}`);
    }

    if (query.orderNumber) {
      conditions.push(
        Prisma.sql`o."orderNumber" ILIKE ${`%${query.orderNumber}%`}`,
      );
    }

    if (query.status) {
      conditions.push(Prisma.sql`o."status" = ${query.status}::"OrderStatus"`);
    }

    if (query.paymentStatus) {
      conditions.push(
        Prisma.sql`o."paymentStatus" = ${query.paymentStatus}::"PaymentStatus"`,
      );
    }

    if (query.paymentMethod) {
      conditions.push(
        Prisma.sql`o."paymentMethod" = ${query.paymentMethod}::"PaymentMethod"`,
      );
    }

    if (query.currency) {
      conditions.push(Prisma.sql`o."currency" = ${query.currency}`);
    }

    if (query.createdFrom) {
      conditions.push(
        Prisma.sql`o."createdAt" >= ${this.parseDate(query.createdFrom)}`,
      );
    }

    if (query.createdTo) {
      conditions.push(
        Prisma.sql`o."createdAt" <= ${this.parseDate(query.createdTo)}`,
      );
    }

    if (conditions.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;
  }

  private mapOrderRow(row: OrderRow) {
    return {
      id: row.id,
      userId: row.user_id,
      orderNumber: row.order_number,
      status: row.status,
      subtotal: this.toDecimalString(row.subtotal),
      taxAmount: this.toDecimalString(row.tax_amount),
      shippingAmount: this.toDecimalString(row.shipping_amount),
      discountAmount: this.toDecimalString(row.discount_amount),
      totalAmount: this.toDecimalString(row.total_amount),
      currency: row.currency,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      shippingAddressId: row.shipping_address_id,
      billingAddressId: row.billing_address_id,
      shippingMethod: row.shipping_method,
      trackingNumber: row.tracking_number,
      notes: row.notes,
      shippedAt: row.shipped_at,
      shippedAtFa: this.toPersianDateTimeString(row.shipped_at),
      deliveredAt: row.delivered_at,
      deliveredAtFa: this.toPersianDateTimeString(row.delivered_at),
      cancelledAt: row.cancelled_at,
      cancelledAtFa: this.toPersianDateTimeString(row.cancelled_at),
      createdAt: row.created_at,
      createdAtFa: this.toPersianDateTimeString(row.created_at),
      updatedAt: row.updated_at,
      updatedAtFa: this.toPersianDateTimeString(row.updated_at),
      deletedAt: row.deleted_at,
      deletedAtFa: this.toPersianDateTimeString(row.deleted_at),
    };
  }

  private mapOrderItemRow(row: OrderItemRow) {
    const price = this.toDecimal(row.price);

    const discount = this.toDecimal(row.discount);

    const quantity = this.toNumber(row.quantity);

    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      variantId: row.variant_id,
      quantity,
      price: price.toString(),
      productName: row.product_name,
      sku: row.sku,
      discount: discount.toString(),
      lineTotal: price.minus(discount).mul(quantity).toString(),
      createdAt: row.created_at,
      createdAtFa: this.toPersianDateTimeString(row.created_at),
      updatedAt: row.updated_at,
      updatedAtFa: this.toPersianDateTimeString(row.updated_at),
    };
  }

  private toPersianDateTimeString(value: Date | null): string | null {
    return formatPersianDateTime(value);
  }

  private buildPagination(query: QueryOrderDto) {
    const page = Math.max(1, Number(query.page ?? 1));

    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const skip = (page - 1) * limit;

    return {
      page,
      limit,
      skip,
    };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private parseDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('تاریخ ارسال‌شده معتبر نیست.');
    }

    return date;
  }

  private toDecimal(value: unknown): Prisma.Decimal {
    if (value === null || value === undefined) {
      return new Prisma.Decimal(0);
    }

    if (value instanceof Prisma.Decimal) {
      return value;
    }

    if (
      typeof value === 'object' &&
      typeof (
        value as {
          toString?: unknown;
        }
      ).toString === 'function'
    ) {
      return new Prisma.Decimal(
        (
          value as {
            toString: () => string;
          }
        ).toString(),
      );
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'bigint':
        return new Prisma.Decimal(String(value));
      default:
        throw new TypeError('Unsupported decimal value.');
    }
  }

  private toDecimalString(value: unknown): string {
    if (value === null || value === undefined) {
      return '0';
    }

    if (
      typeof value === 'object' &&
      typeof (
        value as {
          toString?: unknown;
        }
      ).toString === 'function'
    ) {
      return (
        value as {
          toString: () => string;
        }
      ).toString();
    }

    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
      case 'bigint':
      case 'boolean':
        return String(value);
      default:
        return '0';
    }
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (
      typeof value === 'object' &&
      typeof (
        value as {
          toString?: unknown;
        }
      ).toString === 'function'
    ) {
      return Number(
        (
          value as {
            toString: () => string;
          }
        ).toString(),
      );
    }

    switch (typeof value) {
      case 'number':
        return value;
      case 'bigint':
      case 'string':
      case 'boolean':
        return Number(value);
      default:
        return 0;
    }
  }
}
