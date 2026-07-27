import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AddCartItemDto } from '../dto/add-cart-item.dto';

import { MergeCartDto } from '../dto/merge-cart.dto';

import { UpdateCartItemDto } from '../dto/update-cart-item.dto';

import { CartEventPublisher } from '../events/cart.event.publisher';

type CartWithItems = {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    cartId: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    price: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

type ProductForCartRow = {
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
  variant_compare_price: unknown;
  variant_is_active: boolean | null;
  image_url: string | null;
  image_alt: string | null;
  available_stock: number | bigint | null;
};

type CartSummary = {
  totalItems: number;
  uniqueItems: number;
  subtotal: string;
  unavailableItemsCount: number;
};

const CART_MESSAGES = {
  CART_ITEM_NOT_FOUND: 'آیتم موردنظر در سبد خرید یافت نشد.',
  PRODUCT_NOT_FOUND: 'محصول موردنظر یافت نشد.',
  VARIANT_NOT_FOUND: 'تنوع محصول موردنظر یافت نشد.',
  PRODUCT_NOT_PURCHASABLE: 'این محصول در حال حاضر قابل خرید نیست.',
  VARIANT_NOT_ACTIVE: 'تنوع انتخاب‌شده فعال نیست.',
  INSUFFICIENT_STOCK: 'موجودی این محصول برای تعداد درخواستی کافی نیست.',
} as const;

@Injectable()
export class CartService {
  private readonly cartSelect = {
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    items: {
      select: {
        id: true,
        cartId: true,
        productId: true,
        variantId: true,
        quantity: true,
        price: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    },
  } satisfies Prisma.CartSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: CartEventPublisher,
  ) {}

  async getOrCreateCart(userId: string, actorId?: string): Promise<unknown> {
    const existing = await this.prisma.cart.findUnique({
      where: {
        userId,
      },
      select: this.cartSelect,
    });

    if (existing) {
      return this.hydrateCart(existing);
    }

    const cart = await this.prisma.cart.create({
      data: {
        userId,
      },
      select: this.cartSelect,
    });

    this.eventPublisher.publishCreated({
      cartId: cart.id,
      userId: cart.userId,
      actorId,
      occurredAt: new Date(),
    });

    return this.hydrateCart(cart);
  }

  async getMyCart(userId: string): Promise<unknown> {
    return this.getOrCreateCart(userId, userId);
  }

  async addItem(
    userId: string,
    dto: AddCartItemDto,
    actorId?: string,
  ): Promise<unknown> {
    const cart = await this.ensureCart(userId, actorId);

    const product = await this.getProductForCart(dto.productId, dto.variantId);

    this.assertProductPurchasable(product);

    this.assertStockAvailable(product, dto.quantity);

    const unitPrice = this.resolveUnitPrice(product);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: product.product_id,
          variantId: product.variant_id,
        },
        select: {
          id: true,
          quantity: true,
        },
      });

      if (existing) {
        const nextQuantity = existing.quantity + dto.quantity;

        this.assertStockAvailable(product, nextQuantity);

        const updated = await tx.cartItem.update({
          where: {
            id: existing.id,
          },
          data: {
            quantity: nextQuantity,
            price: unitPrice,
          },
          select: {
            id: true,
            productId: true,
            variantId: true,
            quantity: true,
            price: true,
          },
        });

        await this.touchCartTx(tx, cart.id);

        return {
          item: updated,
          previousQuantity: existing.quantity,
          isNew: false,
        };
      }

      const created = await tx.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.product_id,
          variantId: product.variant_id,
          quantity: dto.quantity,
          price: unitPrice,
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          quantity: true,
          price: true,
        },
      });

      await this.touchCartTx(tx, cart.id);

      return {
        item: created,
        previousQuantity: 0,
        isNew: true,
      };
    });

    if (result.isNew) {
      this.eventPublisher.publishItemAdded({
        cartId: cart.id,
        userId: cart.userId,
        cartItemId: result.item.id,
        productId: result.item.productId,
        variantId: result.item.variantId,
        quantity: result.item.quantity,
        price: result.item.price.toString(),
        actorId: actorId ?? userId,
        occurredAt: new Date(),
      });
    } else {
      this.eventPublisher.publishItemUpdated({
        cartId: cart.id,
        userId: cart.userId,
        cartItemId: result.item.id,
        productId: result.item.productId,
        variantId: result.item.variantId,
        previousQuantity: result.previousQuantity,
        currentQuantity: result.item.quantity,
        actorId: actorId ?? userId,
        occurredAt: new Date(),
      });
    }

    return this.getMyCart(userId);
  }

  async updateItem(
    userId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
    actorId?: string,
  ): Promise<unknown> {
    const cart = await this.ensureCart(userId, actorId);

    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
      select: {
        id: true,
        cartId: true,
        productId: true,
        variantId: true,
        quantity: true,
      },
    });

    if (!item) {
      throw new NotFoundException(CART_MESSAGES.CART_ITEM_NOT_FOUND);
    }

    const product = await this.getProductForCart(
      item.productId,
      item.variantId ?? undefined,
    );

    this.assertProductPurchasable(product);

    this.assertStockAvailable(product, dto.quantity);

    const unitPrice = this.resolveUnitPrice(product);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.cartItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: dto.quantity,
          price: unitPrice,
        },
        select: {
          id: true,
          productId: true,
          variantId: true,
          quantity: true,
        },
      });

      await this.touchCartTx(tx, cart.id);

      return updatedItem;
    });

    this.eventPublisher.publishItemUpdated({
      cartId: cart.id,
      userId: cart.userId,
      cartItemId: updated.id,
      productId: updated.productId,
      variantId: updated.variantId,
      previousQuantity: item.quantity,
      currentQuantity: updated.quantity,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyCart(userId);
  }

  async removeItem(
    userId: string,
    cartItemId: string,
    actorId?: string,
  ): Promise<unknown> {
    const cart = await this.ensureCart(userId, actorId);

    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
      },
    });

    if (!item) {
      throw new NotFoundException(CART_MESSAGES.CART_ITEM_NOT_FOUND);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.delete({
        where: {
          id: item.id,
        },
      });

      await this.touchCartTx(tx, cart.id);
    });

    this.eventPublisher.publishItemRemoved({
      cartId: cart.id,
      userId: cart.userId,
      cartItemId: item.id,
      productId: item.productId,
      variantId: item.variantId,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyCart(userId);
  }

  async clearCart(userId: string, actorId?: string): Promise<unknown> {
    const cart = await this.ensureCart(userId, actorId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      await this.touchCartTx(tx, cart.id);

      return result;
    });

    this.eventPublisher.publishCleared({
      cartId: cart.id,
      userId: cart.userId,
      removedItemsCount: deleted.count,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyCart(userId);
  }

  async mergeCart(
    userId: string,
    dto: MergeCartDto,
    actorId?: string,
  ): Promise<unknown> {
    const cart = await this.ensureCart(userId, actorId);

    let mergedItemsCount = 0;

    for (const item of dto.items) {
      await this.addItem(userId, item, actorId ?? userId);

      mergedItemsCount += 1;
    }

    this.eventPublisher.publishMerged({
      cartId: cart.id,
      userId: cart.userId,
      mergedItemsCount,
      actorId: actorId ?? userId,
      occurredAt: new Date(),
    });

    return this.getMyCart(userId);
  }

  async refreshPrices(userId: string, actorId?: string): Promise<unknown> {
    const cart = await this.ensureCart(userId, actorId);

    const items = await this.prisma.cartItem.findMany({
      where: {
        cartId: cart.id,
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
      },
    });

    let refreshedItemsCount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const product = await this.getProductForCart(
          item.productId,
          item.variantId ?? undefined,
          false,
        );

        if (!product) {
          continue;
        }

        const unitPrice = this.resolveUnitPrice(product);

        await tx.cartItem.update({
          where: {
            id: item.id,
          },
          data: {
            price: unitPrice,
          },
        });

        refreshedItemsCount += 1;
      }

      if (refreshedItemsCount > 0) {
        await this.touchCartTx(tx, cart.id);
      }
    });

    return this.getMyCart(userId);
  }

  private async ensureCart(
    userId: string,
    actorId?: string,
  ): Promise<{
    id: string;
    userId: string;
  }> {
    const cart = await this.prisma.cart.findUnique({
      where: {
        userId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (cart) {
      return cart;
    }

    const created = await this.prisma.cart.create({
      data: {
        userId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    this.eventPublisher.publishCreated({
      cartId: created.id,
      userId: created.userId,
      actorId,
      occurredAt: new Date(),
    });

    return created;
  }

  private async hydrateCart(cart: CartWithItems): Promise<{
    id: string;
    userId: string;
    items: Array<Record<string, unknown>>;
    summary: CartSummary;
    createdAt: Date;
    createdAtFa: string | null;
    updatedAt: Date;
    updatedAtFa: string | null;
  }> {
    const enrichedItems = await Promise.all(
      cart.items.map(async (item) => {
        const product = await this.getProductForCart(
          item.productId,
          item.variantId ?? undefined,
          false,
        );

        const unitPrice = item.price;

        const lineTotal = unitPrice.mul(item.quantity);

        const availableStock = product
          ? this.toNumber(product.available_stock)
          : 0;

        return {
          id: item.id,
          cartId: item.cartId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: unitPrice.toString(),
          lineTotal: lineTotal.toString(),
          product: product ? this.mapProductForCart(product) : null,
          stock: {
            available: availableStock,
            isAvailable: availableStock >= item.quantity,
          },
          createdAt: item.createdAt,
          createdAtFa: formatPersianDateTime(item.createdAt),
          updatedAt: item.updatedAt,
          updatedAtFa: formatPersianDateTime(item.updatedAt),
        };
      }),
    );

    const totalItems = enrichedItems.reduce(
      (sum, item) => sum + Number(item.quantity),
      0,
    );

    const subtotal = enrichedItems.reduce(
      (sum, item) => sum.plus(new Prisma.Decimal(String(item.lineTotal))),
      new Prisma.Decimal(0),
    );

    const unavailableItems = enrichedItems.filter(
      (item) =>
        item.product === null ||
        !(
          item.stock as {
            isAvailable: boolean;
          }
        ).isAvailable,
    );

    return {
      id: cart.id,
      userId: cart.userId,
      items: enrichedItems,
      summary: {
        totalItems,
        uniqueItems: enrichedItems.length,
        subtotal: subtotal.toString(),
        unavailableItemsCount: unavailableItems.length,
      },
      createdAt: cart.createdAt,
      createdAtFa: formatPersianDateTime(cart.createdAt),
      updatedAt: cart.updatedAt,
      updatedAtFa: formatPersianDateTime(cart.updatedAt),
    };
  }

  private async getProductForCart(
    productId: string,
    variantId?: string,
    throwIfNotFound = true,
  ): Promise<ProductForCartRow | null> {
    const rows = await this.prisma.$queryRaw<ProductForCartRow[]>(
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
            pv."comparePrice" AS variant_compare_price,
            pv."isActive" AS variant_is_active,
            image."url" AS image_url,
            image."altText" AS image_alt,
            COALESCE(stock.available_stock, 0)::int AS available_stock
          FROM "Product" p
          LEFT JOIN "ProductVariant" pv
            ON pv."productId" = p."id"
            ${
              variantId
                ? Prisma.sql`AND pv."id" = ${variantId}`
                : Prisma.sql`
                    AND pv."deleted_at" IS NULL
                    AND pv."isActive" = TRUE
                  `
            }
          LEFT JOIN LATERAL (
            SELECT
              pi."url",
              pi."altText"
            FROM "ProductImage" pi
            WHERE pi."productId" = p."id"
            ORDER BY
              pi."isPrimary" DESC,
              pi."sortOrder" ASC,
              pi."createdAt" ASC
            LIMIT 1
          ) image ON TRUE
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
          ) stock ON TRUE
          WHERE p."id" = ${productId}
            AND p."deleted_at" IS NULL
          ORDER BY
            pv."createdAt" ASC NULLS LAST
          LIMIT 1
        `,
    );

    const product = rows[0];

    if (!product && throwIfNotFound) {
      throw new NotFoundException(CART_MESSAGES.PRODUCT_NOT_FOUND);
    }

    if (product && variantId && !product.variant_id && throwIfNotFound) {
      throw new NotFoundException(CART_MESSAGES.VARIANT_NOT_FOUND);
    }

    return product ?? null;
  }

  private assertProductPurchasable(
    product: ProductForCartRow | null,
  ): asserts product is ProductForCartRow {
    if (!product) {
      throw new NotFoundException(CART_MESSAGES.PRODUCT_NOT_FOUND);
    }

    if (!product.product_is_active || product.product_status !== 'ACTIVE') {
      throw new BadRequestException(CART_MESSAGES.PRODUCT_NOT_PURCHASABLE);
    }

    if (product.variant_id && product.variant_is_active === false) {
      throw new BadRequestException(CART_MESSAGES.VARIANT_NOT_ACTIVE);
    }
  }

  private assertStockAvailable(
    product: ProductForCartRow,
    requestedQuantity: number,
  ): void {
    const availableStock = this.toNumber(product.available_stock);

    if (product.variant_id && requestedQuantity > availableStock) {
      throw new BadRequestException(CART_MESSAGES.INSUFFICIENT_STOCK);
    }
  }

  private resolveUnitPrice(product: ProductForCartRow): Prisma.Decimal {
    if (product.variant_price !== null && product.variant_price !== undefined) {
      return this.toDecimal(product.variant_price);
    }

    return this.toDecimal(product.product_price);
  }

  private mapProductForCart(product: ProductForCartRow) {
    const price = this.resolveUnitPrice(product);

    const comparePrice =
      product.variant_compare_price ?? product.product_compare_price;

    return {
      id: product.product_id,
      name: product.product_name,
      slug: product.product_slug,
      sku: product.product_sku,
      price: price.toString(),
      comparePrice: this.toNullableDecimalString(comparePrice),
      variant: product.variant_id
        ? {
            id: product.variant_id,
            sku: product.variant_sku,
            name: product.variant_name,
          }
        : null,
      image: product.image_url
        ? {
            url: product.image_url,
            alt: product.image_alt,
          }
        : null,
    };
  }

  private async touchCartTx(
    tx: Prisma.TransactionClient,
    cartId: string,
  ): Promise<void> {
    await tx.cart.update({
      where: {
        id: cartId,
      },
      data: {
        updatedAt: new Date(),
      },
    });
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

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      return new Prisma.Decimal(value.toString());
    }

    throw new TypeError('Unsupported decimal value.');
  }

  private toNullableDecimalString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toDecimal(value).toString();
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    return Number(value);
  }
}
