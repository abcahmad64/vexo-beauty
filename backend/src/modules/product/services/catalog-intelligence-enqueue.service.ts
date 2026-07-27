import { Injectable, Logger } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  QUEUE_JOB_NAMES,
  QUEUE_NAMES,
} from '../../../core/queue/constants/queue.constants';

import { QueueProducerService } from '../../../core/queue/services/queue-producer.service';

import type { ProductCreatedEventPayload } from '../events/product.event.payloads';

type ProductResearchIdentityRow = {
  id: string;
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
export class CatalogIntelligenceEnqueueService {
  private readonly logger = new Logger(CatalogIntelligenceEnqueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueProducer: QueueProducerService,
  ) {}

  async enqueueForCreatedProduct(
    payload: ProductCreatedEventPayload,
  ): Promise<void> {
    await this.enqueueResearch({
      productId: payload.productId,
      actorId: payload.actorId,
      triggerType: 'PRODUCT_CREATED',
      source: 'product.created',
      occurredAt: payload.occurredAt,
      suppressDuplicateActiveRun: true,
    });
  }

  async enqueueManualResearch(
    productId: string,
    actorId: string,
  ): Promise<{
    researchRunId: string;
    productId: string;
    status: string;
    queueName: string;
    jobName: string;
    jobId: string;
  }> {
    const result = await this.enqueueResearch({
      productId,
      actorId,
      triggerType: 'MANUAL_ADMIN',
      source: 'admin.manual',
      occurredAt: new Date(),
      suppressDuplicateActiveRun: false,
    });

    if (!result) {
      throw new Error('Manual catalog research was not queued.');
    }

    return result;
  }

  private async enqueueResearch(input: {
    productId: string;
    actorId?: string;
    triggerType: 'PRODUCT_CREATED' | 'MANUAL_ADMIN';
    source: 'product.created' | 'admin.manual';
    occurredAt: Date;
    suppressDuplicateActiveRun: boolean;
  }): Promise<{
    researchRunId: string;
    productId: string;
    status: string;
    queueName: string;
    jobName: string;
    jobId: string;
  } | null> {
    const identity = await this.findProductIdentity(input.productId);

    if (!identity) {
      this.logger.warn(
        `Catalog research skipped; product not found: ${input.productId}`,
      );

      return null;
    }

    if (input.suppressDuplicateActiveRun) {
      const existingRun = await this.prisma.catalogResearchRun.findFirst({
        where: {
          productId: input.productId,
          triggerType: input.triggerType,
          status: {
            in: [
              'PENDING',
              'QUEUED',
              'PROCESSING',
              'READY_FOR_WEB_RESEARCH',
              'WEB_RESEARCH_PROCESSING',
            ],
          },
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingRun) {
        this.logger.log(
          `Catalog research already exists: ${existingRun.id}; product=${input.productId}`,
        );

        return null;
      }
    }

    const run = await this.prisma.catalogResearchRun.create({
      data: {
        productId: input.productId,
        brandId: identity.brandId,
        productModelId: identity.productModelId,
        triggerType: input.triggerType,
        scope: 'PRODUCT',
        status: 'PENDING',
        requestedById: input.actorId ?? null,
        requestedQuery: this.buildRequestedQuery(identity),
        normalizedIdentity: this.toJson(identity),
        progressJson: {
          stage: 'CREATED',
          percent: 0,
        },
        summaryJson: {
          source: input.source,
          occurredAt: input.occurredAt.toISOString(),
        },
      },
    });

    try {
      const queued = await this.queueProducer.enqueue({
        queueName: QUEUE_NAMES.AI,
        jobName: QUEUE_JOB_NAMES.AI_PROCESS,
        data: {
          task: 'catalog.research.bootstrap',
          payload: {
            researchRunId: run.id,
            productId: input.productId,
          },
          metadata: {
            source: input.source,
            createdAt: new Date().toISOString(),
            ...(input.actorId
              ? {
                  actorId: input.actorId,
                }
              : {}),
          },
        },
        options: {
          jobId: `catalog-research-${run.id}`,
          attempts: 3,
          backoffDelayMs: 10_000,
          removeOnCompleteCount: 5_000,
          removeOnFailCount: 10_000,
        },
      });

      await this.prisma.catalogResearchRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: 'QUEUED',
          progressJson: {
            stage: 'QUEUED',
            percent: 5,
            queueName: queued.queueName,
            jobName: queued.jobName,
            jobId: queued.jobId,
          },
        },
      });

      this.logger.log(
        `Catalog research queued: ${run.id}; product=${input.productId}; job=${queued.jobId}`,
      );

      return {
        researchRunId: run.id,
        productId: input.productId,
        status: 'QUEUED',
        queueName: queued.queueName,
        jobName: queued.jobName,
        jobId: queued.jobId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.prisma.catalogResearchRun.update({
        where: {
          id: run.id,
        },
        data: {
          status: 'QUEUE_FAILED',
          errorMessage: message.slice(0, 2_000),
          finishedAt: new Date(),
          progressJson: {
            stage: 'QUEUE_FAILED',
            percent: 0,
          },
        },
      });

      throw error;
    }
  }

  private async findProductIdentity(
    productId: string,
  ): Promise<ProductResearchIdentityRow | null> {
    const rows = await this.prisma.$queryRaw<ProductResearchIdentityRow[]>(
      Prisma.sql`
          SELECT
            p."id",
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

  private buildRequestedQuery(identity: ProductResearchIdentityRow): string {
    return [
      identity.brandName,
      identity.productModelCode,
      identity.productModelName,
      identity.name,
      identity.productTypeName,
    ]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();
  }

  private toJson(identity: ProductResearchIdentityRow): Prisma.InputJsonValue {
    return {
      productId: identity.id,
      name: identity.name,
      slug: identity.slug,
      sku: identity.sku,
      brandId: identity.brandId,
      brandName: identity.brandName,
      categoryId: identity.categoryId,
      categoryName: identity.categoryName,
      productTypeId: identity.productTypeId,
      productTypeName: identity.productTypeName,
      productModelId: identity.productModelId,
      productModelName: identity.productModelName,
      productModelCode: identity.productModelCode,
    };
  }
}
