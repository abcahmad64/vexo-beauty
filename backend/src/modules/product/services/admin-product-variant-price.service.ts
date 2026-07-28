import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminUpdateVariantPriceDto } from '../dto/admin-update-variant-price.dto';

import { AdminProductVariantService } from './admin-product-variant.service';

type VariantPriceContext = {
  price: Prisma.Decimal | number | string | null;
  comparePrice: Prisma.Decimal | number | string | null;
};

@Injectable()
export class AdminProductVariantPriceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminProductVariantService: AdminProductVariantService,
  ) {}

  async updatePrice(
    variantId: string,
    dto: AdminUpdateVariantPriceDto,
    actorId?: string,
  ) {
    const variant = (await this.adminProductVariantService.findVariantRow(
      variantId,
      false,
    )) as VariantPriceContext;

    if (dto.price === undefined && dto.comparePrice === undefined) {
      throw new BadRequestException(
        'هیچ داده‌ای برای به‌روزرسانی قیمت ارسال نشده است.',
      );
    }

    /* ADMIN_VARIANT_NULLABLE_PRICE_SERVICE_V1 */

    const nextPrice =
      dto.price !== undefined
        ? this.toNullableDecimal(dto.price)
        : this.toNullableDecimal(variant.price);

    const nextComparePrice =
      dto.comparePrice !== undefined
        ? this.toNullableDecimal(dto.comparePrice)
        : this.toNullableDecimal(
            variant.comparePrice,
          );

    if (nextPrice && nextComparePrice && nextComparePrice.lessThan(nextPrice)) {
      throw new BadRequestException(
        'قیمت قبل از تخفیف نمی‌تواند کمتر از قیمت فروش باشد.',
      );
    }

    const assignments: Prisma.Sql[] = [];

    if (dto.price !== undefined) {
      assignments.push(
        dto.price === null
          ? Prisma.sql`"price" = NULL`
          : Prisma.sql`"price" = ${dto.price}::numeric`,
      );
    }

    if (dto.comparePrice !== undefined) {
      assignments.push(
        dto.comparePrice === null
          ? Prisma.sql`"comparePrice" = NULL`
          : Prisma.sql`"comparePrice" = ${dto.comparePrice}::numeric`,
      );
    }

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ProductVariant"
        SET
          ${Prisma.join(assignments, ', ')},
          "updatedAt" = ${now}
        WHERE
          "id" = ${variantId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      variant: await this.adminProductVariantService.findOne(variantId),
      audit: {
        actorId: actorId ?? null,
        action: 'product_variant.price_updated',
        reason: dto.reason ?? null,
      },
    };
  }

  private toNullableDecimal(
    value:
      | Prisma.Decimal
      | number
      | string
      | null,
  ): Prisma.Decimal | null {
    if (value === null) {
      return null;
    }

    return new Prisma.Decimal(value.toString());
  }
}
