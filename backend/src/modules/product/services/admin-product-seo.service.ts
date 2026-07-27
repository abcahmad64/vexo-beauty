import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { AdminProductSeoDto } from '../dto/admin-product-seo.dto';

import { AdminProductService } from './admin-product.service';

type ProductSeoRow = {
  id: string;
  dimensions: Prisma.JsonValue | null;
  updatedAt: Date | null;
};

@Injectable()
export class AdminProductSeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminProductService: AdminProductService,
  ) {}

  async getSeo(productId: string) {
    await this.adminProductService.findProductRow(productId, true);

    const row = await this.findProductSeoRow(productId);

    const dimensions = this.toRecord(row.dimensions);

    return {
      productId,
      seo: this.toRecord(dimensions.seo),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
      updatedAtFa: this.formatDateTimeFaNullable(row.updatedAt),
    };
  }

  async updateSeo(
    productId: string,
    dto: AdminProductSeoDto,
    actorId?: string,
  ) {
    await this.adminProductService.findProductRow(productId, true);

    const row = await this.findProductSeoRow(productId);

    const dimensions = this.toRecord(row.dimensions);

    const seo = this.cleanSeoPayload(dto);

    const nextDimensions = {
      ...dimensions,
      seo,
    };

    const now = new Date();

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Product"
        SET
          "dimensions" = ${JSON.stringify(nextDimensions)}::jsonb,
          "updatedAt" = ${now}
        WHERE
          "id" = ${productId}
          AND "deleted_at" IS NULL
      `,
    );

    return {
      productId,
      seo,
      updatedAt: now.toISOString(),
      updatedAtFa: this.formatDateTimeFaNullable(now),
      audit: {
        actorId: actorId ?? null,
        action: 'product.seo_updated',
      },
    };
  }

  private async findProductSeoRow(productId: string): Promise<ProductSeoRow> {
    const rows = await this.prisma.$queryRaw<ProductSeoRow[]>(
      Prisma.sql`
          SELECT
            "id",
            "dimensions",
            "updatedAt"
          FROM "Product"
          WHERE "id" = ${productId}
          LIMIT 1
        `,
    );

    return (
      rows[0] ?? {
        id: productId,
        dimensions: null,
        updatedAt: null,
      }
    );
  }

  private cleanSeoPayload(dto: AdminProductSeoDto): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (dto.metaTitle !== undefined) {
      payload.metaTitle = dto.metaTitle;
    }

    if (dto.metaDescription !== undefined) {
      payload.metaDescription = dto.metaDescription;
    }

    if (dto.keywords !== undefined) {
      payload.keywords = dto.keywords;
    }

    if (dto.canonicalUrl !== undefined) {
      payload.canonicalUrl = dto.canonicalUrl;
    }

    if (dto.ogTitle !== undefined) {
      payload.ogTitle = dto.ogTitle;
    }

    if (dto.ogDescription !== undefined) {
      payload.ogDescription = dto.ogDescription;
    }

    if (dto.ogImage !== undefined) {
      payload.ogImage = dto.ogImage;
    }

    if (dto.noIndex !== undefined) {
      payload.noIndex = dto.noIndex;
    }

    if (dto.noFollow !== undefined) {
      payload.noFollow = dto.noFollow;
    }

    return payload;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private formatDateTimeFaNullable(date: Date | null): string | null {
    if (!date) {
      return null;
    }

    return formatPersianDateTime(date) ?? null;
  }
}
