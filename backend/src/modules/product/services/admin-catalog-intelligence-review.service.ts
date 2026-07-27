import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';

import { PrismaService } from '../../../core/prisma/prisma.service';

import {
  AdminApproveCatalogSuggestionDto,
  AdminBulkCatalogSuggestionReviewDto,
  AdminCatalogResearchRunQueryDto,
  AdminCatalogSuggestionQueryDto,
  AdminRejectCatalogSuggestionDto,
} from '../dto/admin-catalog-intelligence.dto';

type ReviewableSuggestion = Prisma.CatalogResearchFieldSuggestionGetPayload<{
  include: {
    researchRun: true;
    source: true;
  };
}>;

@Injectable()
export class AdminCatalogIntelligenceReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listRuns(productId: string, query: AdminCatalogResearchRunQueryDto) {
    await this.assertProductExists(productId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CatalogResearchRunWhereInput = {
      productId,
      deletedAt: null,
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogResearchRun.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              sources: true,
              suggestions: true,
            },
          },
        },
      }),
      this.prisma.catalogResearchRun.count({
        where,
      }),
    ]);

    return {
      items,
      meta: this.buildMeta(total, page, limit),
    };
  }

  async getRun(productId: string, researchRunId: string) {
    await this.assertProductExists(productId);

    const run = await this.prisma.catalogResearchRun.findFirst({
      where: {
        id: researchRunId,
        productId,
        deletedAt: null,
      },
      include: {
        sources: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            {
              isOfficial: 'desc',
            },
            {
              trustScore: 'desc',
            },
            {
              retrievedAt: 'desc',
            },
          ],
        },
        suggestions: {
          where: {
            deletedAt: null,
          },
          include: {
            source: true,
          },
          orderBy: [
            {
              adminDecision: 'asc',
            },
            {
              conflictGroup: 'asc',
            },
            {
              confidence: 'desc',
            },
            {
              createdAt: 'asc',
            },
          ],
        },
      },
    });

    if (!run) {
      throw new NotFoundException(
        'اجرای تحقیق کاتالوگ برای این محصول یافت نشد.',
      );
    }

    return run;
  }

  async listSuggestions(
    productId: string,
    researchRunId: string,
    query: AdminCatalogSuggestionQueryDto,
  ) {
    await this.assertRunBelongsToProduct(productId, researchRunId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CatalogResearchFieldSuggestionWhereInput = {
      researchRunId,
      productId,
      deletedAt: null,
      ...(query.fieldPath
        ? {
            fieldPath: query.fieldPath,
          }
        : {}),
      ...(query.adminDecision
        ? {
            adminDecision: query.adminDecision,
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogResearchFieldSuggestion.findMany({
        where,
        include: {
          source: true,
        },
        orderBy: [
          {
            adminDecision: 'asc',
          },
          {
            conflictGroup: 'asc',
          },
          {
            confidence: 'desc',
          },
          {
            createdAt: 'asc',
          },
        ],
        skip,
        take: limit,
      }),
      this.prisma.catalogResearchFieldSuggestion.count({
        where,
      }),
    ]);

    return {
      items,
      meta: this.buildMeta(total, page, limit),
    };
  }

  async approveSuggestion(
    productId: string,
    researchRunId: string,
    suggestionId: string,
    dto: AdminApproveCatalogSuggestionDto,
    reviewerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.approveSuggestionWithTx(
        tx,
        productId,
        researchRunId,
        suggestionId,
        dto,
        reviewerId,
      );

      await this.refreshRunReviewStatus(tx, researchRunId);

      return result;
    });
  }

  async rejectSuggestion(
    productId: string,
    researchRunId: string,
    suggestionId: string,
    dto: AdminRejectCatalogSuggestionDto,
    reviewerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.rejectSuggestionWithTx(
        tx,
        productId,
        researchRunId,
        suggestionId,
        dto.adminNote,
        reviewerId,
      );

      await this.refreshRunReviewStatus(tx, researchRunId);

      return result;
    });
  }

  async bulkReviewSuggestions(
    productId: string,
    researchRunId: string,
    dto: AdminBulkCatalogSuggestionReviewDto,
    reviewerId: string,
  ) {
    const suggestionIds = [...new Set(dto.suggestionIds)];

    if (dto.decision === 'REJECT' && !dto.adminNote?.trim()) {
      throw new BadRequestException(
        'برای رد گروهی پیشنهادها، ثبت دلیل الزامی است.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const suggestions = await tx.catalogResearchFieldSuggestion.findMany({
        where: {
          id: {
            in: suggestionIds,
          },
          researchRunId,
          productId,
          deletedAt: null,
        },
        include: {
          researchRun: true,
          source: true,
        },
      });

      if (suggestions.length !== suggestionIds.length) {
        throw new NotFoundException(
          'یک یا چند پیشنهاد انتخاب‌شده در این پرونده تحقیق یافت نشد.',
        );
      }

      if (dto.decision === 'APPROVE') {
        const fieldPaths = suggestions.map(
          (suggestion) => suggestion.fieldPath,
        );

        if (new Set(fieldPaths).size !== fieldPaths.length) {
          throw new ConflictException(
            'برای تأیید گروهی، از هر فیلد فقط یک مقدار را انتخاب کنید.',
          );
        }
      }

      const results: unknown[] = [];

      for (const suggestion of suggestions) {
        if (dto.decision === 'APPROVE') {
          results.push(
            await this.approveLoadedSuggestionWithTx(
              tx,
              suggestion,
              {
                adminNote: dto.adminNote,
              },
              reviewerId,
            ),
          );
        } else {
          results.push(
            await this.rejectLoadedSuggestionWithTx(
              tx,
              suggestion,
              dto.adminNote ?? '',
              reviewerId,
            ),
          );
        }
      }

      const status = await this.refreshRunReviewStatus(tx, researchRunId);

      return {
        researchRunId,
        decision: dto.decision,
        reviewedCount: results.length,
        status,
        canonicalProductUpdated: false,
        results,
      };
    });
  }

  async listApprovedKnowledge(productId: string) {
    await this.assertProductExists(productId);

    return this.prisma.catalogApprovedKnowledge.findMany({
      where: {
        productId,
        isCurrent: true,
        deletedAt: null,
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: new Date(),
            },
          },
        ],
      },
      orderBy: [
        {
          fieldPath: 'asc',
        },
        {
          version: 'desc',
        },
      ],
    });
  }

  private async approveSuggestionWithTx(
    tx: Prisma.TransactionClient,
    productId: string,
    researchRunId: string,
    suggestionId: string,
    dto: AdminApproveCatalogSuggestionDto,
    reviewerId: string,
  ) {
    const suggestion = await this.findReviewableSuggestion(
      tx,
      productId,
      researchRunId,
      suggestionId,
    );

    return this.approveLoadedSuggestionWithTx(tx, suggestion, dto, reviewerId);
  }

  private async approveLoadedSuggestionWithTx(
    tx: Prisma.TransactionClient,
    suggestion: ReviewableSuggestion,
    dto: AdminApproveCatalogSuggestionDto,
    reviewerId: string,
  ) {
    if (suggestion.adminDecision === 'APPROVED') {
      throw new ConflictException('این پیشنهاد قبلاً تأیید شده است.');
    }

    const now = new Date();

    const latestVersion = await tx.catalogApprovedKnowledge.aggregate({
      where: {
        productId: suggestion.productId,
        fieldPath: suggestion.fieldPath,
        deletedAt: null,
      },
      _max: {
        version: true,
      },
    });

    await tx.catalogApprovedKnowledge.updateMany({
      where: {
        productId: suggestion.productId,
        fieldPath: suggestion.fieldPath,
        isCurrent: true,
        deletedAt: null,
      },
      data: {
        isCurrent: false,
      },
    });

    const sourceUrls = suggestion.source?.sourceUrl
      ? [suggestion.source.sourceUrl]
      : [];

    const approvedKnowledge = await tx.catalogApprovedKnowledge.create({
      data: {
        productId: suggestion.productId,
        brandId: suggestion.researchRun.brandId,
        productModelId: suggestion.researchRun.productModelId,
        fieldPath: suggestion.fieldPath,
        normalizedValue: this.resolveNormalizedValue(
          suggestion.normalizedValue,
          dto.normalizedValue,
        ),
        displayValue: dto.displayValue ?? suggestion.displayValue,
        unit: dto.unit ?? suggestion.unit,
        sourceSuggestionId: suggestion.id,
        sourceUrlsJson: sourceUrls,
        confidence: suggestion.confidence,
        approvedById: reviewerId,
        approvedAt: now,
        version: (latestVersion._max.version ?? 0) + 1,
        isCurrent: true,
        metadataJson: {
          researchRunId: suggestion.researchRunId,
          sourceId: suggestion.sourceId,
          sourceVerification: suggestion.source?.verification ?? null,
          conflictGroup: suggestion.conflictGroup,
          verificationStatus: suggestion.verificationStatus,
          adminNote: dto.adminNote ?? null,
          approvalMode: 'ADMIN_REVIEW',
          canonicalProductUpdated: false,
        },
      },
    });

    const updatedSuggestion = await tx.catalogResearchFieldSuggestion.update({
      where: {
        id: suggestion.id,
      },
      data: {
        adminDecision: 'APPROVED',
        adminNote: dto.adminNote,
        reviewedById: reviewerId,
        reviewedAt: now,
        appliedAt: null,
      },
    });

    return {
      suggestion: updatedSuggestion,
      approvedKnowledge,
      canonicalProductUpdated: false,
    };
  }

  private async rejectSuggestionWithTx(
    tx: Prisma.TransactionClient,
    productId: string,
    researchRunId: string,
    suggestionId: string,
    adminNote: string,
    reviewerId: string,
  ) {
    const suggestion = await this.findReviewableSuggestion(
      tx,
      productId,
      researchRunId,
      suggestionId,
    );

    return this.rejectLoadedSuggestionWithTx(
      tx,
      suggestion,
      adminNote,
      reviewerId,
    );
  }

  private async rejectLoadedSuggestionWithTx(
    tx: Prisma.TransactionClient,
    suggestion: ReviewableSuggestion,
    adminNote: string,
    reviewerId: string,
  ) {
    if (suggestion.adminDecision === 'APPROVED') {
      throw new ConflictException('پیشنهاد تأییدشده را نمی‌توان رد کرد.');
    }

    return tx.catalogResearchFieldSuggestion.update({
      where: {
        id: suggestion.id,
      },
      data: {
        adminDecision: 'REJECTED',
        adminNote,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        appliedAt: null,
      },
    });
  }

  private async findReviewableSuggestion(
    tx: Prisma.TransactionClient,
    productId: string,
    researchRunId: string,
    suggestionId: string,
  ): Promise<ReviewableSuggestion> {
    const suggestion = await tx.catalogResearchFieldSuggestion.findFirst({
      where: {
        id: suggestionId,
        researchRunId,
        productId,
        deletedAt: null,
      },
      include: {
        researchRun: true,
        source: true,
      },
    });

    if (!suggestion || suggestion.researchRun.productId !== productId) {
      throw new NotFoundException(
        'پیشنهاد تحقیق برای این محصول و اجرای تحقیق یافت نشد.',
      );
    }

    return suggestion;
  }

  private async refreshRunReviewStatus(
    tx: Prisma.TransactionClient,
    researchRunId: string,
  ): Promise<string> {
    const [run, pending, approved, rejected, conflicts] = await Promise.all([
      tx.catalogResearchRun.findUnique({
        where: {
          id: researchRunId,
        },
        select: {
          summaryJson: true,
        },
      }),
      tx.catalogResearchFieldSuggestion.count({
        where: {
          researchRunId,
          adminDecision: 'PENDING',
          deletedAt: null,
        },
      }),
      tx.catalogResearchFieldSuggestion.count({
        where: {
          researchRunId,
          adminDecision: 'APPROVED',
          deletedAt: null,
        },
      }),
      tx.catalogResearchFieldSuggestion.count({
        where: {
          researchRunId,
          adminDecision: 'REJECTED',
          deletedAt: null,
        },
      }),
      tx.catalogResearchFieldSuggestion.count({
        where: {
          researchRunId,
          adminDecision: 'PENDING',
          conflictGroup: {
            not: null,
          },
          deletedAt: null,
        },
      }),
    ]);

    const status = pending === 0 ? 'COMPLETED' : 'READY_FOR_REVIEW';

    await tx.catalogResearchRun.update({
      where: {
        id: researchRunId,
      },
      data: {
        status,
        finishedAt: pending === 0 ? new Date() : undefined,
        progressJson: {
          stage: pending === 0 ? 'ADMIN_REVIEW_COMPLETED' : 'ADMIN_REVIEW',
          percent: pending === 0 ? 100 : 80,
        },
        summaryJson: this.toJsonObject({
          ...this.toRecord(run?.summaryJson),
          pendingSuggestions: pending,
          approvedSuggestions: approved,
          rejectedSuggestions: rejected,
          conflictSuggestions: conflicts,
        }),
      },
    });

    return status;
  }

  private async assertProductExists(productId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id"
        FROM "Product"
        WHERE "id" = ${productId}
          AND "deleted_at" IS NULL
        LIMIT 1
      `,
    );

    if (!rows[0]) {
      throw new NotFoundException('محصول یافت نشد.');
    }
  }

  private async assertRunBelongsToProduct(
    productId: string,
    researchRunId: string,
  ): Promise<void> {
    const run = await this.prisma.catalogResearchRun.findFirst({
      where: {
        id: researchRunId,
        productId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!run) {
      throw new NotFoundException(
        'اجرای تحقیق کاتالوگ برای این محصول یافت نشد.',
      );
    }
  }

  private resolveNormalizedValue(
    currentValue: Prisma.JsonValue,
    overrideValue: unknown,
  ): Prisma.CatalogApprovedKnowledgeCreateInput['normalizedValue'] {
    const value = overrideValue === undefined ? currentValue : overrideValue;
    const normalizedValue = this.toInputJsonValue(value);

    return normalizedValue ?? Prisma.JsonNull;
  }

  private toJsonObject(value: unknown): Prisma.InputJsonObject {
    const record = this.toRecord(value);
    const result: Record<string, Prisma.InputJsonValue | null> = {};

    for (const [key, item] of Object.entries(record)) {
      if (item === undefined) {
        continue;
      }

      result[key] = this.toInputJsonValue(item);
    }

    return result;
  }

  private toInputJsonValue(value: unknown): Prisma.InputJsonValue | null {
    if (value === null) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.toInputJsonValue(item));
    }

    if (!this.isRecord(value)) {
      return null;
    }

    return this.toJsonObject(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private buildMeta(total: number, page: number, limit: number) {
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: totalPages > 0 && page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
