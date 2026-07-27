import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

type CatalogResearchBootstrapPayload = {
  researchRunId: string;
  productId: string;
};

type ProductBootstrapRow = {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  brandId: string;
  brandName: string | null;
  categoryId: string;
  categoryName: string | null;
  productTypeId: string | null;
  productTypeName: string | null;
  productModelId: string | null;
  productModelName: string | null;
  productModelCode: string | null;
};

@Injectable()
export class CatalogResearchBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(
    payload: CatalogResearchBootstrapPayload,
  ): Promise<Record<string, unknown>> {
    const researchRunId = this.requireString(
      payload.researchRunId,
      'researchRunId',
    );

    const productId = this.requireString(payload.productId, 'productId');

    const run = await this.prisma.catalogResearchRun.findUnique({
      where: {
        id: researchRunId,
      },
    });

    if (!run || run.deletedAt) {
      throw new NotFoundException('پرونده تحقیق کاتالوگ پیدا نشد.');
    }

    if (run.productId !== productId) {
      throw new BadRequestException('محصول Job با پرونده تحقیق مطابقت ندارد.');
    }

    await this.prisma.catalogResearchRun.update({
      where: {
        id: researchRunId,
      },
      data: {
        status: 'PROCESSING',
        startedAt: run.startedAt ?? new Date(),
        errorMessage: null,
        progressJson: {
          stage: 'IDENTITY_RESOLUTION',
          percent: 20,
        },
      },
    });

    const product = await this.findProduct(productId);

    if (!product) {
      await this.prisma.catalogResearchRun.update({
        where: {
          id: researchRunId,
        },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: 'Product not found.',
          progressJson: {
            stage: 'FAILED',
            percent: 20,
          },
        },
      });

      throw new NotFoundException('محصول مربوط به تحقیق پیدا نشد.');
    }

    const normalizedIdentity = this.buildIdentity(product);

    const requestedQuery = this.buildQuery(product);

    await this.prisma.catalogResearchRun.update({
      where: {
        id: researchRunId,
      },
      data: {
        status: 'READY_FOR_WEB_RESEARCH',
        requestedQuery,
        normalizedIdentity,
        progressJson: {
          stage: 'READY_FOR_WEB_RESEARCH',
          percent: 30,
        },
        summaryJson: {
          productResolved: true,
          brandResolved: Boolean(product.brandName),
          modelResolved: Boolean(
            product.productModelCode || product.productModelName,
          ),
          nextStage: 'TRUSTED_SOURCE_RESEARCH',
        },
      },
    });

    return {
      task: 'catalog.research.bootstrap',
      researchRunId,
      productId,
      status: 'READY_FOR_WEB_RESEARCH',
      requestedQuery,
      normalizedIdentity,
    };
  }

  private async findProduct(
    productId: string,
  ): Promise<ProductBootstrapRow | null> {
    const rows = await this.prisma.$queryRaw<ProductBootstrapRow[]>(
      Prisma.sql`
          SELECT
            p."id" AS "productId",
            p."name",
            p."slug",
            p."sku",
            p."brandId",
            b."name" AS "brandName",
            p."categoryId",
            c."name" AS "categoryName",
            p."productTypeId",
            pt."name" AS "productTypeName",
            p."productModelId",
            pm."name" AS "productModelName",
            pm."modelCode" AS "productModelCode"
          FROM "Product" p
          LEFT JOIN "Brand" b
            ON b."id" = p."brandId"
           AND b."deleted_at" IS NULL
          LEFT JOIN "Category" c
            ON c."id" = p."categoryId"
           AND c."deleted_at" IS NULL
          LEFT JOIN "ProductType" pt
            ON pt."id" = p."productTypeId"
           AND pt."deleted_at" IS NULL
          LEFT JOIN "ProductModel" pm
            ON pm."id" = p."productModelId"
           AND pm."deleted_at" IS NULL
          WHERE p."id" = ${productId}
            AND p."deleted_at" IS NULL
          LIMIT 1
        `,
    );

    return rows[0] ?? null;
  }

  private buildIdentity(product: ProductBootstrapRow): Prisma.InputJsonValue {
    return {
      productId: product.productId,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brand: {
        id: product.brandId,
        name: product.brandName,
      },
      category: {
        id: product.categoryId,
        name: product.categoryName,
      },
      productType: {
        id: product.productTypeId,
        name: product.productTypeName,
      },
      productModel: {
        id: product.productModelId,
        name: product.productModelName,
        modelCode: product.productModelCode,
      },
    };
  }

  private buildQuery(product: ProductBootstrapRow): string {
    return [
      product.brandName,
      product.productModelCode,
      product.productModelName,
      product.name,
      product.productTypeName,
    ]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();
  }

  private requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`فیلد ${field} معتبر نیست.`);
    }

    return value.trim();
  }
}
